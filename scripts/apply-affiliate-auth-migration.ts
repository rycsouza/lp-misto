import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE affiliates
      ADD COLUMN IF NOT EXISTS login_token text,
      ADD COLUMN IF NOT EXISTS login_token_expires_at timestamptz
  `;

  console.log("Done ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
