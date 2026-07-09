-- Cantina — vale pré-pago por item (desacoplado do jogo). Aditivo: não mexe no
-- Bar atual (bar_*), que segue funcionando até o rename/remoção numa fase futura.

-- Catálogo à venda (sem jogo). Cap de estoque GLOBAL e opcional.
CREATE TABLE IF NOT EXISTS "cantina_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text NOT NULL DEFAULT 'outro',
  "price_cents" integer NOT NULL,
  "image_url" text,
  "needs_prep" boolean NOT NULL DEFAULT false,
  "stock_cap" integer,
  "stock_sold" integer NOT NULL DEFAULT 0,
  "active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Vale = uma linha por item comprado (qty_total / qty_redeemed). Vale só quando o pedido está pago.
CREATE TABLE IF NOT EXISTS "cantina_vouchers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "item_id" uuid REFERENCES "cantina_items"("id") ON DELETE SET NULL,
  "item_name" text NOT NULL,
  "unit_price_cents" integer NOT NULL,
  "needs_prep" boolean NOT NULL DEFAULT false,
  "qty_total" integer NOT NULL,
  "qty_redeemed" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "cantina_vouchers_customer_idx" ON "cantina_vouchers" ("customer_id");

-- Retirada (pickup) no balcão, no dia do jogo. Passa por preparo se necessário.
CREATE TABLE IF NOT EXISTS "cantina_redemptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "game_id" uuid REFERENCES "games"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "created_by" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "delivered_at" timestamptz,
  "delivered_by" text
);

-- Linhas da retirada.
CREATE TABLE IF NOT EXISTS "cantina_redemption_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "redemption_id" uuid NOT NULL REFERENCES "cantina_redemptions"("id") ON DELETE CASCADE,
  "voucher_id" uuid NOT NULL REFERENCES "cantina_vouchers"("id") ON DELETE CASCADE,
  "item_name" text NOT NULL,
  "needs_prep" boolean NOT NULL DEFAULT false,
  "qty" integer NOT NULL
);
CREATE INDEX IF NOT EXISTS "cantina_redemption_items_redemption_idx" ON "cantina_redemption_items" ("redemption_id");
