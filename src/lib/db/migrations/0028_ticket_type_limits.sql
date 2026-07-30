-- Limite de venda por tipo de ingresso.
-- max_quantity: teto de venda (NULL = ilimitado).
-- sold_count: quantidade comprometida (pedidos pagos + PIX pendente ativo),
--   mantida atomicamente no checkout e devolvida em expiração/cancelamento/estorno.
ALTER TABLE ticket_types
  ADD COLUMN IF NOT EXISTS max_quantity integer,
  ADD COLUMN IF NOT EXISTS sold_count integer NOT NULL DEFAULT 0;
