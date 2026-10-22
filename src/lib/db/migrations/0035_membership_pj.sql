-- Sócio-torcedor: planos de pessoa física (CPF) e planos empresariais (CNPJ).
-- audience = 'pf' (CPF, padrão) ou 'pj' (CNPJ). Plano 'empresarial' vira 'pj' (backfill).
-- members.cnpj e members.company_name: preenchidos só na adesão de plano 'pj'.
-- Idempotente (IF NOT EXISTS, constraint em DO com duplicate_object, backfill com filtro).
-- Rollback: 0035_membership_pj.rollback.sql
ALTER TABLE "membership_plans" ADD COLUMN IF NOT EXISTS "audience" text DEFAULT 'pf' NOT NULL;

DO $$ BEGIN
  ALTER TABLE "membership_plans"
    ADD CONSTRAINT "membership_plans_audience_check" CHECK ("audience" IN ('pf', 'pj'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "cnpj" text;
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "company_name" text;

-- Backfill: o plano empresarial (slug 'empresarial') é de CNPJ. Só mexe no que ainda está 'pf'.
UPDATE "membership_plans" SET "audience" = 'pj'
  WHERE "slug" = 'empresarial' AND "audience" = 'pf';
