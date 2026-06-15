import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  console.log("Applying membership migration...");
  try {
    await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS cpf text`;
    await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS asaas_customer_id text`;
    await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS subscription_id text`;
    await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS next_billing_date timestamp with time zone`;
    await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone`;
    await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS member_card_token text`;
    await sql`ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS description text`;
    await sql`ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS ticket_discount_pct integer NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS product_discount_pct integer NOT NULL DEFAULT 0`;
    // unique constraint (safe if already exists)
    try {
      await sql`ALTER TABLE members ADD CONSTRAINT members_member_card_token_unique UNIQUE(member_card_token)`;
    } catch { /* already exists */ }
    console.log("Done ✓");
  } catch (e) {
    console.error("Migration error:", e);
    process.exit(1);
  }
}

run();
