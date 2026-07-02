-- Rollback do 0019_bar_online.sql.
-- ATENÇÃO: derruba as tabelas do bar e as colunas novas de orders. Só rode se
-- não houver dados de bar que você queira preservar.

DROP TABLE IF EXISTS "bar_game_offerings";
DROP TABLE IF EXISTS "bar_menu_items";

ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_game_id_games_id_fk";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "service_fee_cents";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "game_id";
