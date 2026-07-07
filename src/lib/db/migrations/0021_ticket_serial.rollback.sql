-- Rollback do 0021_ticket_serial.sql.
DROP INDEX IF EXISTS "tickets_serial_no_idx";
ALTER TABLE "tickets" DROP COLUMN IF EXISTS "serial_no";
