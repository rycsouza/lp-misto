-- Logo da empresa do sócio (plano empresarial, CNPJ). NULL = sem logo.
-- logo_url: URL https do Cloudinary já na transformação de entrega (quadrada 512 px, sem recorte, fundo transparente).
-- logo_public_id: id do asset no Cloudinary, para apagar o logo anterior ao trocar ou remover.
-- Idempotente (IF NOT EXISTS). Rollback: 0036_member_logo.rollback.sql
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "logo_url" text;
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "logo_public_id" text;
