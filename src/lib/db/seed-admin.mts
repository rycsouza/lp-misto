import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import bcrypt from "bcryptjs";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

const email = process.env.ADMIN_SEED_EMAIL;
const password = process.env.ADMIN_SEED_PASSWORD;

if (!email || !password) {
  console.error("ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD devem estar definidos no .env.local");
  process.exit(1);
}

const existing = await sql`SELECT id FROM admin_users WHERE role = 'admin' LIMIT 1`;
if (existing.length > 0) {
  console.warn("Já existe um admin. Seed ignorado.");
  process.exit(0);
}

const passwordHash = await bcrypt.hash(password, 12);

const name = email.split("@")[0];

await sql`
  INSERT INTO admin_users (email, password_hash, name, role, permissions)
  VALUES (${email}, ${passwordHash}, ${name}, 'admin', '{}')
`;

console.log(`Admin criado: ${email}`);
