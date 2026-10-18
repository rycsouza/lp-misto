    -- Sócio-torcedor: ledger local das mensalidades (espelho do gateway, para relatórios).
    -- Os valores vêm SEMPRE de uma reconsulta ao gateway (nunca do corpo do webhook).
    -- Idempotente (IF NOT EXISTS). Rollback: 0033_membership_payments.rollback.sql
    CREATE TABLE IF NOT EXISTS "membership_payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "member_id" uuid REFERENCES "members"("id") ON DELETE SET NULL,
        "plan_id" uuid REFERENCES "membership_plans"("id") ON DELETE SET NULL,
        "gateway_slug" text,
        "gateway_payment_id" text NOT NULL,
        "subscription_id" text,
        "value_cents" integer NOT NULL,
        "net_value_cents" integer,
        "status" text NOT NULL,
        "due_date" date,
        "paid_at" timestamp with time zone,
        "billing_type" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "membership_payments_status_check" CHECK ("status" IN ('pending', 'confirmed', 'received', 'overdue', 'refunded', 'chargeback', 'cancelled'))
    );
    
    -- Idempotência: a mesma cobrança do gateway nunca vira duas linhas (upsert por este índice).
    CREATE UNIQUE INDEX IF NOT EXISTS "membership_payments_gateway_payment_id_idx" ON "membership_payments" ("gateway_payment_id");
    CREATE INDEX IF NOT EXISTS "membership_payments_paid_at_idx" ON "membership_payments" ("paid_at");
    CREATE INDEX IF NOT EXISTS "membership_payments_member_id_idx" ON "membership_payments" ("member_id");
    CREATE INDEX IF NOT EXISTS "membership_payments_status_idx" ON "membership_payments" ("status");
    
    -- Última sincronização do ledger por sócio: ordena o lote do cron/backfill (os mais antigos primeiro).
    ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "ledger_synced_at" timestamp with time zone;
