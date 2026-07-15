// Cria o PRIMEIRO admin do sistema (platform_admins) no PLATFORM_DATABASE_URL.
// Rode DEPOIS de aplicar a migration 0001 no platform DB.
//
// Uso (lê do .env.local ou de flags):
//   node scripts/seed-platform-admin.mjs \
//     --email you@sport55.com.br --name "Seu Nome" --password "SENHA_FORTE"          # dry-run
//   node scripts/seed-platform-admin.mjs --email ... --name ... --password ... --commit
//
// Idempotente: se o e-mail já existe, não recria (use o painel p/ trocar senha).
// A senha NUNCA é gravada em claro — bcrypt (custo 12), igual ao adminUsers.

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import fs from "node:fs";

function envFile(key) {
  try {
    const m = fs.readFileSync(".env.local", "utf8").match(new RegExp("^" + key + "=(.*)$", "m"));
    return m ? m[1].replace(/^["']|["']$/g, "").trim() : "";
  } catch {
    return "";
  }
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : "";
}

const platformUrl = envFile("PLATFORM_DATABASE_URL") || process.env.PLATFORM_DATABASE_URL || "";
const email = (arg("email") || process.env.PLATFORM_ADMIN_EMAIL || "").toLowerCase().trim();
const name = arg("name") || process.env.PLATFORM_ADMIN_NAME || "";
const password = arg("password") || process.env.PLATFORM_ADMIN_PASSWORD || "";
const COMMIT = process.argv.includes("--commit");

if (!platformUrl) {
  console.error("Falta PLATFORM_DATABASE_URL (no .env.local ou no ambiente).");
  process.exit(1);
}
if (!email || !name || !password) {
  console.error("Faltam --email, --name e/ou --password.");
  process.exit(1);
}
if (password.length < 10) {
  console.error("A senha do admin do sistema deve ter no mínimo 10 caracteres.");
  process.exit(1);
}

const sql = neon(platformUrl);

const existing = await sql`select id from platform_admins where email = ${email} limit 1`;
if (existing[0]) {
  console.log(`Admin do sistema com e-mail ${email} já existe: ${existing[0].id}. Nada a fazer.`);
  process.exit(0);
}

if (!COMMIT) {
  console.log(`[dry-run] criaria admin do sistema: ${name} <${email}> (senha via bcrypt).`);
  console.log("Rode de novo com --commit para aplicar.");
  process.exit(0);
}

const passwordHash = await bcrypt.hash(password, 12);
const r = await sql`
  insert into platform_admins (email, name, password_hash)
  values (${email}, ${name}, ${passwordHash})
  returning id`;
console.log(`✅ Admin do sistema criado: ${r[0].id} (${email}).`);
