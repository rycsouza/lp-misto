-- Índice funcional para a busca de pedidos por WhatsApp (Meus Pedidos / lookup).
-- A query usa regexp_replace(customer_whatsapp, '[^0-9]', '', 'g') = $1, que
-- ignora qualquer índice comum na coluna (a função na coluna não é sargável).
-- Indexando a MESMA expressão, o planner passa a usar o índice — sem alterar o
-- dado armazenado (customer_whatsapp continua formatado para exibição no admin).
CREATE INDEX IF NOT EXISTS "orders_customer_whatsapp_digits_idx"
  ON "orders" (regexp_replace("customer_whatsapp", '[^0-9]', '', 'g'));
