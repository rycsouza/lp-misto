-- Área logada do cliente (/conta) + troca de plano de sócio no próximo vencimento.
-- Idempotente (IF NOT EXISTS). Rollback: 0030_customer_accounts.rollback.sql
CREATE TABLE IF NOT EXISTS "customer_accounts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "email" text NOT NULL UNIQUE,
    "name" text NOT NULL,
    "whatsapp" text,
    "password_hash" text NOT NULL,
    "email_verified_at" timestamp with time zone,
    "password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );

ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "pending_plan_id" uuid REFERENCES "membership_plans"("id") ON DELETE SET NULL;
