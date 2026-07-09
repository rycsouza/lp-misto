-- Rollback do 0023_cantina.sql (ordem inversa por causa das FKs).
DROP TABLE IF EXISTS "cantina_redemption_items";
DROP TABLE IF EXISTS "cantina_redemptions";
DROP TABLE IF EXISTS "cantina_vouchers";
DROP TABLE IF EXISTS "cantina_items";
