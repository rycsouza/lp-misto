-- Correção de dados: libera números de sorteio presos em pedidos
-- reembolsados/cancelados (estornos anteriores ao fix de releaseRaffleNumbers).
-- Idempotente e seguro: só toca números cujo pedido dono não está pago.
-- NÃO afeta sorteios já apurados (o reembolso desses já é bloqueado no app).

UPDATE raffle_numbers rn
SET status = 'available',
    order_id = NULL,
    reserved_until = NULL,
    assigned_at = NULL
FROM orders o
WHERE rn.order_id = o.id
  AND o.status IN ('refunded', 'cancelled')
  AND rn.status <> 'available';
