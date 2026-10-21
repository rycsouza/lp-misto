-- Foto de perfil do sócio (enviada pela área logada). NULL = sem foto.
-- photo_url: URL https do Cloudinary, já na transformação de entrega (quadrada, rosto centralizado).
-- photo_public_id: id do asset no Cloudinary, para apagar a foto antiga ao trocar ou remover.
-- Idempotente (IF NOT EXISTS). Rollback: 0034_member_photo.rollback.sql
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "photo_url" text;
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "photo_public_id" text;
