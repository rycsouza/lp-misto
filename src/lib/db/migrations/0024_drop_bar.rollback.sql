-- Rollback do 0024_drop_bar.sql — recria a ESTRUTURA das tabelas do Bar.
-- OBS: os DADOS apagados no DROP não são recuperáveis por este rollback.
-- As chaves de config 'bar.%' também não são restauradas.

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

CREATE TABLE IF NOT EXISTS "bar_game_offerings" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "game_id"              uuid NOT NULL REFERENCES "games"("id") ON DELETE cascade,
  "menu_item_id"         uuid NOT NULL REFERENCES "bar_menu_items"("id") ON DELETE cascade,
  "price_cents_override" integer,
  "stock_total"          integer,
  "stock_sold"           integer NOT NULL DEFAULT 0,
  "active"               boolean NOT NULL DEFAULT true,
  "created_at"           timestamptz NOT NULL DEFAULT now(),
  "updated_at"           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "bar_game_offerings_game_item_idx"
  ON "bar_game_offerings" ("game_id", "menu_item_id");
