import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS gateway_slug text`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS gateway_customer_id text`;
  console.log("Done ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
