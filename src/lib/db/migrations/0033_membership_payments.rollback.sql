-- Rollback da 0033: remove o ledger de mensalidades e a coluna de controle do cron.
-- ATENÇÃO: apaga o histórico local de mensalidades (o gateway continua com os dados).
DROP TABLE IF EXISTS "membership_payments";
ALTER TABLE "members" DROP COLUMN IF EXISTS "ledger_synced_at";
