-- Flag idempotente: garante que o estoque de um pedido seja devolvido ao pool
-- EXATAMENTE UMA VEZ, mesmo que estorno manual (refundOrder) e webhook de estorno
-- disparem juntos. A devolução só ocorre no claim atômico
--   UPDATE orders SET stock_restored = true WHERE id = ? AND stock_restored = false RETURNING
-- Pedidos antigos já cancelados/estornados ficam como false (sem reprocessar).

ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_restored boolean NOT NULL DEFAULT false;
