-- Rollback da 0037: remove o Pix Automático do sócio.
-- ATENÇÃO: antes de rodar, cancele no Asaas as autorizações ativas. Sem o id gravado aqui, os
-- webhooks dessas autorizações deixam de achar o sócio.
DROP INDEX IF EXISTS "members_pix_automatic_pending_authorization_id_idx";
ALTER TABLE "members" DROP COLUMN IF EXISTS "pix_automatic_pending_plan_id";
ALTER TABLE "members" DROP COLUMN IF EXISTS "pix_automatic_pending_authorization_id";
DROP INDEX IF EXISTS "members_pix_automatic_authorization_id_idx";
ALTER TABLE "members" DROP COLUMN IF EXISTS "pix_automatic_authorization_id";
ALTER TABLE "members" DROP COLUMN IF EXISTS "payment_method";
