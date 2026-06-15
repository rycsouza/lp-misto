import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Add affiliate_code to leads
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS affiliate_code text`;

  // Add affiliate_id to coupons
  await sql`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS affiliate_id uuid REFERENCES affiliates(id) ON DELETE SET NULL`;

  // Add affiliate_code to members
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS affiliate_code text`;

  // Add login_token columns to affiliates (if not done by previous migration)
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS login_token text`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS login_token_expires_at timestamptz`;

  // Create affiliate_withdrawals table
  await sql`
    CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      affiliate_id uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
      amount_cents integer NOT NULL,
      pix_key text NOT NULL,
      pix_key_type text NOT NULL CHECK (pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'random')),
      status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'processing', 'paid', 'rejected')),
      rejection_reason text,
      requested_at timestamptz NOT NULL DEFAULT now(),
      processed_at timestamptz
    )
  `;

  console.log("Done ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
