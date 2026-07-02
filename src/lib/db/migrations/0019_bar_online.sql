-- Bar Online (cashless / ficha digital) — camada de dados do MVP.
--
-- A ficha reaproveita `orders` (type "bar"): ganha pagamento, idempotência e o
-- ciclo de vida via fulfillment_status (pending=em preparo · ready=pronto ·
-- delivered=entregue). Aqui adicionamos:
--   1. orders.game_id + orders.service_fee_cents (nullable; não afeta pedidos existentes)
--   2. bar_menu_items  — catálogo de itens reutilizável entre jogos
--   3. bar_game_offerings — o que vende em cada jogo + preço/estoque
-- order_items.type ganha "bar" apenas no TS (enum sem CHECK no banco) — sem DDL.

-- 1) orders: vínculo com o jogo + taxa de serviço da ficha ---------------------
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "game_id" uuid;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "service_fee_cents" integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_game_id_games_id_fk'
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_game_id_games_id_fk"
      FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE set null;
  END IF;
END $$;

-- 2) Catálogo de itens do bar --------------------------------------------------
CREATE TABLE IF NOT EXISTS "bar_menu_items" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"        text NOT NULL,
  "description" text,
  "category"    text NOT NULL DEFAULT 'outro',
  "price_cents" integer NOT NULL,
  "image_url"   text,
  "needs_prep"  boolean NOT NULL DEFAULT false,
  "active"      boolean NOT NULL DEFAULT true,
  "sort_order"  integer NOT NULL DEFAULT 0,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

-- 3) Oferta (preço/estoque) por jogo ------------------------------------------
CREATE TABLE IF NOT EXISTS "bar_game_offerings" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "game_id"              uuid NOT NULL REFERENCES "games"("id") ON DELETE cascade,
  "menu_item_id"         uuid NOT NULL REFERENCES "bar_menu_items"("id") ON DELETE cascade,
  "price_cents_override" integer,
  "stock_total"          integer,           -- null = ilimitado
  "stock_sold"           integer NOT NULL DEFAULT 0,
  "active"               boolean NOT NULL DEFAULT true,
  "created_at"           timestamptz NOT NULL DEFAULT now(),
  "updated_at"           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "bar_game_offerings_game_item_idx"
  ON "bar_game_offerings" ("game_id", "menu_item_id");
