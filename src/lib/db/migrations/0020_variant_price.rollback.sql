-- Rollback do 0020_variant_price.sql.
ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "price_cents";
