/**
 * Registra o Mercado Pago como gateway ativo no banco.
 *
 * Uso:
 *   MP_ACCESS_TOKEN=APP_USR-xxx MP_PUBLIC_KEY=APP_USR-yyy node scripts/setup-mercadopago-gateway.mjs
 *
 * Opcional: para sandbox use MP_SANDBOX=true
 */
import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

const DB_URL = process.env.DATABASE_URL;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? "aEtzV6fB9UmbeGExnpuGqW7U4PmZGwNN";

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const PUBLIC_KEY = process.env.MP_PUBLIC_KEY;

if (!ACCESS_TOKEN || !PUBLIC_KEY) {
  console.error("Defina MP_ACCESS_TOKEN e MP_PUBLIC_KEY como variáveis de ambiente.");
  process.exit(1);
}

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

const credentials = JSON.stringify({
  accessToken: ACCESS_TOKEN,
  publicKey: PUBLIC_KEY,
  sandbox: process.env.MP_SANDBOX === "true",
});

const encrypted = encrypt(credentials);
const sql = neon(DB_URL);

// Desativar gateways existentes
await sql`UPDATE payment_gateways SET active = false`;

// Inserir ou atualizar MP
const existing = await sql`SELECT id FROM payment_gateways WHERE slug = 'mercadopago'`;
if (existing.length > 0) {
  await sql`
    UPDATE payment_gateways
    SET credentials = ${encrypted}, active = true, updated_at = now()
    WHERE slug = 'mercadopago'
  `;
  console.log("✅ Gateway Mercado Pago atualizado e ativado.");
} else {
  await sql`
    INSERT INTO payment_gateways (name, slug, credentials, active)
    VALUES ('Mercado Pago', 'mercadopago', ${encrypted}, true)
  `;
  console.log("✅ Gateway Mercado Pago criado e ativado.");
}
