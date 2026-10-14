-- Sócio-torcedor (entrega 1): planos com destaque, promoção e ingressos grátis,
-- detalhe por benefício, campos de sócio (mês grátis, mural) e resgate de ingresso
-- grátis por jogo em casa. Idempotente (IF NOT EXISTS). Rollback: 0032_socio_planos.rollback.sql
ALTER TABLE "membership_plans" ADD COLUMN IF NOT EXISTS "free_tickets_per_home_game" integer DEFAULT 0 NOT NULL;
ALTER TABLE "membership_plans" ADD COLUMN IF NOT EXISTS "first_month_free" boolean DEFAULT false NOT NULL;
ALTER TABLE "membership_plans" ADD COLUMN IF NOT EXISTS "promo_ends_at" timestamp with time zone;
ALTER TABLE "membership_plans" ADD COLUMN IF NOT EXISTS "highlight_label" text;
ALTER TABLE "membership_plans" ADD COLUMN IF NOT EXISTS "card_color" text;

ALTER TABLE "plan_benefits" ADD COLUMN IF NOT EXISTS "detail" text;

ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp with time zone;
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "has_paid" boolean DEFAULT false NOT NULL;
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "wall_name" text;

-- Sócios já ativos/suspensos chegaram por pagamento (ativação manual é usada
-- para pagamento em dinheiro): marcam has_paid. Idempotente.
UPDATE "members" SET "has_paid" = true
  WHERE "status" IN ('active', 'suspended') AND "has_paid" = false;

CREATE TABLE IF NOT EXISTS "member_ticket_redemptions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "member_id" uuid NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
    "game_id" uuid NOT NULL REFERENCES "games"("id") ON DELETE CASCADE,
    "seq" integer NOT NULL,
    "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );

CREATE UNIQUE INDEX IF NOT EXISTS "member_ticket_redemptions_member_game_seq_idx" ON "member_ticket_redemptions" ("member_id", "game_id", "seq");
