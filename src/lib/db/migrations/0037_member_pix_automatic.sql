-- Pix Automático na assinatura do sócio (Asaas, Jornada 3).
-- payment_method: forma de pagamento da assinatura ('card' | 'pix_automatic'). NULL = cartão (cadastros antigos).
-- pix_automatic_authorization_id: id da autorização do Pix Automático no gateway (o pagador autoriza no app do banco).
--   Único: um webhook da autorização acha no máximo um sócio.
-- Idempotente (IF NOT EXISTS). Rollback: 0037_member_pix_automatic.rollback.sql
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "payment_method" text;
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "pix_automatic_authorization_id" text;
CREATE UNIQUE INDEX IF NOT EXISTS "members_pix_automatic_authorization_id_idx" ON "members" ("pix_automatic_authorization_id");
