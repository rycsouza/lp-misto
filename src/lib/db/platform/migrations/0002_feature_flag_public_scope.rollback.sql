-- Rollback da migration 0002 (platform DB).
ALTER TABLE platform_feature_flags DROP COLUMN IF EXISTS public_too;
