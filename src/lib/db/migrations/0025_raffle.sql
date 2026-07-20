-- Migration 0025 — Rifa/Sorteio. Roda no DB do TENANT (não no platform).
-- Aplicar via Neon HTTP. Idempotente (IF NOT EXISTS).
-- O enum orderItems.type já inclui "raffle" (migração anterior) — não muda aqui.

CREATE TABLE IF NOT EXISTS raffles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text NOT NULL UNIQUE,
  name               text NOT NULL,
  description        text,
  image_urls         jsonb NOT NULL DEFAULT '[]'::jsonb,
  number_price_cents integer NOT NULL,
  total_numbers      integer NOT NULL,
  max_per_customer   integer,
  status             text NOT NULL DEFAULT 'draft',
  sales_ends_at      timestamptz,
  drawn_at           timestamptz,
  active             boolean NOT NULL DEFAULT true,
  "order"            integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS raffle_numbers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id      uuid NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  number         integer NOT NULL,
  status         text NOT NULL DEFAULT 'available',
  order_id       uuid REFERENCES orders(id) ON DELETE SET NULL,
  reserved_until timestamptz,
  assigned_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS raffle_numbers_raffle_number_idx
  ON raffle_numbers (raffle_id, number);
CREATE INDEX IF NOT EXISTS raffle_numbers_raffle_status_idx
  ON raffle_numbers (raffle_id, status);
CREATE INDEX IF NOT EXISTS raffle_numbers_order_idx
  ON raffle_numbers (order_id);

CREATE TABLE IF NOT EXISTS raffle_prizes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id        uuid NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  name             text NOT NULL,
  description      text,
  image_url        text,
  rank             integer NOT NULL DEFAULT 0,
  winning_number   integer,
  winner_photo_url text,
  drawn_at         timestamptz,
  drawn_by         text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS raffle_prizes_raffle_idx ON raffle_prizes (raffle_id);
