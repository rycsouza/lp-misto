-- Código numérico sequencial por ingresso, para digitação manual na validação
-- (quando o QR não escaneia). O QR/token continua sendo o identificador oficial;
-- serial_no serve só como código curto legível.
-- bigserial cria a sequência, backfilla as linhas existentes e define NOT NULL default.
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "serial_no" bigserial;
CREATE UNIQUE INDEX IF NOT EXISTS "tickets_serial_no_idx" ON "tickets" ("serial_no");
