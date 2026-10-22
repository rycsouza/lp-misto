-- Rollback da 0036: remove o logo da empresa do sócio.
-- ATENÇÃO: apaga as URLs e os ids gravados. Os arquivos continuam no Cloudinary (apague pelo painel se preciso).
ALTER TABLE "members" DROP COLUMN IF EXISTS "logo_public_id";
ALTER TABLE "members" DROP COLUMN IF EXISTS "logo_url";
