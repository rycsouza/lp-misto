-- Colunas de retirada/entrega (novas nesta migration).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fulfillment_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "pickup_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_by" text;--> statement-breakpoint
-- Colunas abaixo já existiam no banco (drift do snapshot do drizzle) — IF NOT EXISTS as torna no-op.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_address" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_cost_cents" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_service_name" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "requires_shipping" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "weight_grams" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "width_cm" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "height_cm" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "length_cm" integer;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "addresses" jsonb DEFAULT '[]'::jsonb;
