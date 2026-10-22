-- Rollback da 0035: remove o tipo de plano (CPF/CNPJ) e os dados de empresa do sócio.
-- ATENÇÃO: apaga members.cnpj e members.company_name (dados de empresa já gravados).
-- Sócios de plano 'pj' ficam sem documento de CPF (members.cpf é NULL nesses casos):
-- antes de rodar, confira se há sócios empresariais ativos.
ALTER TABLE "members" DROP COLUMN IF EXISTS "company_name";
ALTER TABLE "members" DROP COLUMN IF EXISTS "cnpj";
ALTER TABLE "membership_plans" DROP CONSTRAINT IF EXISTS "membership_plans_audience_check";
ALTER TABLE "membership_plans" DROP COLUMN IF EXISTS "audience";
