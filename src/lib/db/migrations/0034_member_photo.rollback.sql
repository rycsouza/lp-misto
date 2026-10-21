-- Rollback da 0034: remove a foto de perfil do sócio.
-- ATENÇÃO: apaga as URLs e os ids gravados. Os arquivos continuam no Cloudinary (apague pelo painel se preciso).
ALTER TABLE "members" DROP COLUMN IF EXISTS "photo_public_id";
ALTER TABLE "members" DROP COLUMN IF EXISTS "photo_url";
