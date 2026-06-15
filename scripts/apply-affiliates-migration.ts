import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // affiliates table
  await sql`
    CREATE TABLE IF NOT EXISTS affiliates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      whatsapp text,
      code text NOT NULL UNIQUE,
      commission_type text NOT NULL DEFAULT 'pct' CHECK (commission_type IN ('pct', 'fixed')),
      commission_value integer NOT NULL DEFAULT 10,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  // affiliate_referrals table
  await sql`
    CREATE TABLE IF NOT EXISTS affiliate_referrals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      affiliate_id uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
      order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      commission_cents integer NOT NULL,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
      paid_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  // Add affiliate_code to orders
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS affiliate_code text`;

  console.log("Done ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
