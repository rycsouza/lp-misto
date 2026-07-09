-- Rollback do 0022_game_sales_ends_at.sql.
ALTER TABLE "games" DROP COLUMN IF EXISTS "ticket_sales_ends_at";
