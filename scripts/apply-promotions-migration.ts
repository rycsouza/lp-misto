import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Add sale fields to products
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price_cents integer`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_ends_at timestamptz`;

  // Create promotions table
  await sql`
    CREATE TABLE IF NOT EXISTS promotions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      description text,
      discount_type text NOT NULL CHECK (discount_type IN ('pct', 'fixed')),
      discount_value integer NOT NULL,
      applies_to text NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'tickets', 'products')),
      min_order_cents integer NOT NULL DEFAULT 0,
      starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      active boolean NOT NULL DEFAULT true,
      flash_sale boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  console.log("Done ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
