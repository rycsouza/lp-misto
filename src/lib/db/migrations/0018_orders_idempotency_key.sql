-- Idempotência de pedido: chave por tentativa de checkout (gerada no client).
-- Índice ÚNICO impede que duplo-clique/retry de rede crie pedido ou cobrança
-- duplicados. NULL é permitido múltiplas vezes (pedidos legados/sem chave).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
CREATE UNIQUE INDEX IF NOT EXISTS "orders_idempotency_key_idx"
  ON "orders" ("idempotency_key");
