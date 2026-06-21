/**
 * Gera a database_url criptografada para inserir no Platform DB.
 * Uso: npx tsx scripts/encrypt-db-url.ts
 * Requer: .env.local com ENCRYPTION_KEY e DATABASE_URL definidos.
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { encrypt } from "../src/lib/payment/encryption";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL não encontrada em .env.local");
  process.exit(1);
}

const encrypted = encrypt(url);
console.log("\n✅ DATABASE_URL criptografada (cole no INSERT do Platform DB):\n");
console.log(encrypted);
console.log();
