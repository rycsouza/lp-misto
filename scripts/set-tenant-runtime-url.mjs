// Troca a connection string ARMAZENADA de um tenant (cifrada em
// organizations.database_url) — usado para migrar o tenant para o papel
// app_runtime (só-CRUD). Re-cifra com ENCRYPTION_KEY_PLATFORM_DB e atualiza o
// platform DB; tenta invalidar o cache Redis dos domínios (best-effort).
//
// Uso:
//   TENANT_SLUG=misto RUNTIME_DATABASE_URL='postgresql://app_runtime:...' \
//     node scripts/set-tenant-runtime-url.mjs            # dry-run
//   ...mesmo comando + --commit                          # aplica
//
// Após aplicar: faça um REDEPLOY na Vercel para reciclar as instâncias (o getDb
// cacheia a conexão por instância e por ~300s no Redis). O papel antigo (owner)
// continua válido até lá — sem downtime.

import { neon } from "@neondatabase/serverless";
import { createCipheriv, randomBytes } from "node:crypto";
import fs from "node:fs";

function env(key) {
  const m = fs.readFileSync(".env.local", "utf8").match(new RegExp("^" + key + "=(.*)$", "m"));
  return m ? m[1].replace(/^["']|["']$/g, "").trim() : "";
}
function encryptWithKey(plaintext, hexKey) {
  const key = Buffer.from(hexKey, "hex");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY_PLATFORM_DB deve ter 32 bytes (64 hex chars)");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}
function maskUrl(u) {
  return u.replace(/:\/\/([^:]+):[^@]+@/, "://$1:****@");
}

const platformUrl = env("PLATFORM_DATABASE_URL");
const platKey = env("ENCRYPTION_KEY_PLATFORM_DB");
const slug = process.env.TENANT_SLUG || "misto";
const newUrl = process.env.RUNTIME_DATABASE_URL || "";
const COMMIT = process.argv.includes("--commit");

if (!platformUrl || !platKey) { console.error("Faltam PLATFORM_DATABASE_URL / ENCRYPTION_KEY_PLATFORM_DB no .env.local"); process.exit(1); }
if (!newUrl || !newUrl.startsWith("postgres")) { console.error("Defina RUNTIME_DATABASE_URL com a connection string do app_runtime do tenant."); process.exit(1); }

const sql = neon(platformUrl);
const [org] = await sql`select id, slug from organizations where slug = ${slug} limit 1`;
if (!org) { console.error(`Org '${slug}' não encontrada.`); process.exit(1); }
const domains = await sql`select domain from organization_domains where org_id = ${org.id}`;

console.log(`Tenant: ${slug} (${org.id})`);
console.log(`Nova URL: ${maskUrl(newUrl)}`);
console.log(`Domínios p/ invalidar no cache: ${domains.map((d) => d.domain).join(", ")}`);

if (!COMMIT) { console.log("\nDRY-RUN. Rode com --commit para aplicar."); process.exit(0); }

const enc = encryptWithKey(newUrl, platKey);
await sql`update organizations set database_url = ${enc} where id = ${org.id}`;
console.log("✅ organizations.database_url atualizado.");

// Invalidação do cache Redis (best-effort — pode faltar @upstash/redis local).
try {
  const { Redis } = await import("@upstash/redis");
  const r = new Redis({ url: env("UPSTASH_REDIS_REST_URL"), token: env("UPSTASH_REDIS_REST_TOKEN") });
  for (const d of domains) await r.del(`tenant:domain:${d.domain}`);
  console.log("✅ Cache Redis invalidado.");
} catch {
  console.log("⚠️  Não invalidei o Redis (pacote/env ausente). O cache expira em ~300s; ou limpe no console Upstash.");
}
console.log("➡️  Faça um REDEPLOY na Vercel para reciclar as instâncias.");
