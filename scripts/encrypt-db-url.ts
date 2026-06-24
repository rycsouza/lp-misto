/**
 * Gera a database_url criptografada para inserir no Platform DB.
 *
 * Uso normal (lê do .env.local):
 *   npx tsx scripts/encrypt-db-url.ts
 *
 * Ou passando explicitamente:
 *   ENCRYPTION_KEY_PLATFORM_DB=<hex64> DATABASE_URL="<url>" npx tsx scripts/encrypt-db-url.ts
 *
 * Para gerar uma nova chave (caso ainda não tenha):
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createCipheriv, randomBytes } from "crypto";

// .env.local tem prioridade; .env como fallback
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const rawKey = process.env.ENCRYPTION_KEY_PLATFORM_DB;
const dbUrl = process.env.DATABASE_URL;

if (!rawKey) {
  console.error("❌ ENCRYPTION_KEY_PLATFORM_DB não encontrada.");
  console.error("");
  console.error("   1. Gere uma nova chave:");
  console.error('      node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  console.error("");
  console.error("   2. Adicione ao .env.local:");
  console.error("      ENCRYPTION_KEY_PLATFORM_DB=<hex64chars>");
  console.error("");
  console.error("   3. Adicione a mesma chave no Vercel:");
  console.error("      Settings → Environment Variables → ENCRYPTION_KEY_PLATFORM_DB");
  process.exit(1);
}

if (!dbUrl) {
  console.error("❌ DATABASE_URL não encontrada no .env.local.");
  process.exit(1);
}

const key = Buffer.from(rawKey, "hex");
if (key.length !== 32) {
  console.error(`❌ ENCRYPTION_KEY_PLATFORM_DB inválida: ${rawKey.length} chars → ${key.length} bytes (esperado 32).`);
  console.error("   A chave deve ter exatamente 64 caracteres hexadecimais.");
  process.exit(1);
}

const iv = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", key, iv);
const encrypted = Buffer.concat([cipher.update(dbUrl, "utf8"), cipher.final()]);
const tag = cipher.getAuthTag();
const result = Buffer.concat([iv, tag, encrypted]).toString("base64");

console.log("\n✅ DATABASE_URL criptografada (cole no INSERT do Platform DB):\n");
console.log(result);
console.log();
