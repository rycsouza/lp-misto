-- Preço por variante (loja). null = a variante usa o preço do produto.
-- Coluna nullable → não afeta variantes/pedidos existentes.
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "price_cents" integer;
