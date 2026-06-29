// Estágio 2b — cadastra o MISTO como tenant no platform DB.
// Lê PLATFORM_DATABASE_URL, DATABASE_URL (misto) e ENCRYPTION_KEY_PLATFORM_DB do
// .env.local; cifra a URL do misto e insere em organizations + organization_domains.
//
// Uso:
//   node scripts/register-misto-tenant.mjs            # dry-run (não escreve)
//   node scripts/register-misto-tenant.mjs --commit   # aplica
//
// Idempotente: se a org 'misto' já existe, reaproveita; domínios usam ON CONFLICT.
// ATENÇÃO: depois disso, requests ao domínio do misto passam a resolver o tenant
// e usam a URL ARMAZENADA (não mais o DATABASE_URL). Confirme que a URL do misto
// no .env.local é a correta de produção antes de --commit. Teste num branch Neon.

import { neon } from "@neondatabase/serverless";
import { createCipheriv, randomBytes } from "node:crypto";
import fs from "node:fs";

const DOMAINS = ["mistoesporteclube.com.br", "www.mistoesporteclube.com.br", "localhost"];
const PRIMARY = "mistoesporteclube.com.br";

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
  const tag = c.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

const platformUrl = env("PLATFORM_DATABASE_URL");
const mistoUrl = env("DATABASE_URL");
const platKey = env("ENCRYPTION_KEY_PLATFORM_DB");
const COMMIT = process.argv.includes("--commit");

if (!platformUrl || !mistoUrl || !platKey) {
  console.error("Faltam PLATFORM_DATABASE_URL, DATABASE_URL ou ENCRYPTION_KEY_PLATFORM_DB no .env.local");
  process.exit(1);
}

const sql = neon(platformUrl);

const existing = await sql`select id from organizations where slug = 'misto' limit 1`;
let orgId = existing[0]?.id;

if (orgId) {
  console.log(`Org 'misto' já existe: ${orgId}`);
} else if (COMMIT) {
  const enc = encryptWithKey(mistoUrl, platKey);
  const r = await sql`
    insert into organizations (name, slug, database_url, status)
    values ('Misto Esporte Clube', 'misto', ${enc}, 'active')
    returning id`;
  orgId = r[0].id;
  console.log(`Org 'misto' criada: ${orgId}`);
} else {
  console.log("[dry-run] criaria org 'misto' com a URL do misto cifrada (ENCRYPTION_KEY_PLATFORM_DB)");
}

for (const d of DOMAINS) {
  if (COMMIT && orgId) {
    await sql`
      insert into organization_domains (domain, org_id, is_primary, verified_at)
      values (${d}, ${orgId}, ${d === PRIMARY}, now())
      on conflict (domain) do nothing`;
    console.log(`domínio cadastrado: ${d}${d === PRIMARY ? " (primário)" : ""}`);
  } else {
    console.log(`[dry-run] cadastraria domínio: ${d}${d === PRIMARY ? " (primário)" : ""}`);
  }
}

console.log(COMMIT ? "✅ FEITO. Invalide o cache Redis dos domínios se necessário (TTL 300s)." : "DRY-RUN ok. Rode com --commit para aplicar.");
