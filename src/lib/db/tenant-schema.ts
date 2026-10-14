// Schema SQL for new tenant databases.
// Each element is one DDL statement, executed in order via a transaction.
export const TENANT_SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "site_config" (
    "key" text PRIMARY KEY NOT NULL,
    "value" text NOT NULL,
    "type" text DEFAULT 'string' NOT NULL,
    "description" text,
    "updated_at" timestamp with time zone NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "games" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "season" integer NOT NULL,
    "competition" text NOT NULL,
    "round" text NOT NULL,
    "date" timestamp with time zone NOT NULL,
    "is_home" boolean DEFAULT false NOT NULL,
    "opponent" text NOT NULL,
    "opponent_crest_url" text,
    "venue" text NOT NULL,
    "ticket_price_inteira_cents" integer,
    "ticket_price_meia_cents" integer,
    "meia_eligibility_label" text,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "board_members" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "role" text NOT NULL,
    "profession" text,
    "photo_url" text,
    "group" text NOT NULL,
    "fiscal_type" text,
    "order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "legends" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "photo_url" text,
    "position" text,
    "active" boolean DEFAULT true NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "news" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "title" text NOT NULL,
    "summary" text NOT NULL,
    "category" text NOT NULL,
    "image_url" text,
    "source" text,
    "source_url" text,
    "featured" boolean DEFAULT false NOT NULL,
    "published_at" date,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "personalities" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "photo_url" text,
    "role" text,
    "category" text NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "players" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "number" integer,
    "position" text NOT NULL,
    "photo_url" text,
    "season" integer NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "sponsors" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "logo_url" text NOT NULL,
    "logo_tone" text DEFAULT 'light' NOT NULL,
    "tier" text NOT NULL,
    "instagram_url" text,
    "active" boolean DEFAULT true NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "timeline_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "year" text NOT NULL,
    "title" text NOT NULL,
    "description" text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "leads" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "email" text NOT NULL,
    "whatsapp" text,
    "source" text NOT NULL,
    "metadata" jsonb,
    "affiliate_code" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "leads_email_source_idx" ON "leads" ("email", "source")`,

  `CREATE TABLE IF NOT EXISTS "payment_gateways" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "slug" text NOT NULL,
    "credentials" text NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    "payment_methods" text[] DEFAULT ARRAY['pix','credit_card'] NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "payment_gateways_slug_unique" UNIQUE("slug")
  )`,

  `CREATE TABLE IF NOT EXISTS "customers" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "email" text NOT NULL,
    "whatsapp" text NOT NULL,
    "cpf" text,
    "addresses" jsonb DEFAULT '[]'::jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "customers_whatsapp_unique" UNIQUE("whatsapp")
  )`,

  `CREATE TABLE IF NOT EXISTS "products" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "slug" text NOT NULL,
    "category" text NOT NULL,
    "price_cents" integer NOT NULL,
    "sale_price_cents" integer,
    "sale_ends_at" timestamp with time zone,
    "image_url" text,
    "active" boolean DEFAULT true NOT NULL,
    "coming_soon" boolean DEFAULT false NOT NULL,
    "limited_stock" boolean DEFAULT false NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "stock" integer,
    "requires_shipping" boolean DEFAULT true NOT NULL,
    "weight_grams" integer,
    "width_cm" integer,
    "height_cm" integer,
    "length_cm" integer,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "products_slug_unique" UNIQUE("slug")
  )`,

  `CREATE TABLE IF NOT EXISTS "product_variants" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "color" text,
    "color_image_url" text,
    "size" text NOT NULL,
    "stock" integer,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "product_waitlist" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "name" text NOT NULL,
    "email" text NOT NULL,
    "whatsapp" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "membership_benefits" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "label" text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "membership_plans" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "slug" text NOT NULL,
    "icon" text NOT NULL,
    "description" text,
    "price_cents" integer NOT NULL,
    "ticket_discount_pct" integer DEFAULT 0 NOT NULL,
    "product_discount_pct" integer DEFAULT 0 NOT NULL,
    "highlight" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "membership_plans_slug_unique" UNIQUE("slug")
  )`,

  `CREATE TABLE IF NOT EXISTS "plan_benefits" (
    "plan_id" uuid NOT NULL REFERENCES "membership_plans"("id") ON DELETE CASCADE,
    "benefit_id" uuid NOT NULL REFERENCES "membership_benefits"("id") ON DELETE CASCADE,
    "included" boolean DEFAULT true NOT NULL,
    CONSTRAINT "plan_benefits_plan_id_benefit_id_pk" PRIMARY KEY("plan_id","benefit_id")
  )`,

  `CREATE TABLE IF NOT EXISTS "members" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "lead_id" uuid REFERENCES "leads"("id") ON DELETE SET NULL,
    "name" text NOT NULL,
    "email" text NOT NULL,
    "whatsapp" text,
    "cpf" text,
    "plan_id" uuid REFERENCES "membership_plans"("id") ON DELETE SET NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "gateway_slug" text,
    "gateway_customer_id" text,
    "asaas_customer_id" text,
    "subscription_id" text,
    "next_billing_date" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "affiliate_code" text,
    "member_card_token" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "members_email_unique" UNIQUE("email"),
    CONSTRAINT "members_member_card_token_unique" UNIQUE("member_card_token")
  )`,

  `CREATE TABLE IF NOT EXISTS "orders" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL,
    "customer_name" text NOT NULL,
    "customer_email" text NOT NULL,
    "customer_whatsapp" text NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "total_cents" integer NOT NULL,
    "affiliate_code" text,
    "pickup_info" text,
    "shipping_address" jsonb,
    "shipping_cost_cents" integer,
    "shipping_service_name" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "order_items" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
    "type" text NOT NULL,
    "reference_id" uuid,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price_cents" integer NOT NULL,
    "metadata" jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "payments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
    "gateway_slug" text NOT NULL,
    "gateway_payment_id" text,
    "status" text DEFAULT 'pending' NOT NULL,
    "amount_cents" integer NOT NULL,
    "pix_qr_code" text,
    "pix_qr_code_url" text,
    "pix_expires_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "affiliates" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "email" text NOT NULL,
    "whatsapp" text,
    "code" text NOT NULL,
    "commission_type" text DEFAULT 'pct' NOT NULL,
    "commission_value" integer DEFAULT 10 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "login_token" text,
    "login_token_expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "affiliates_email_unique" UNIQUE("email"),
    CONSTRAINT "affiliates_code_unique" UNIQUE("code")
  )`,

  `CREATE TABLE IF NOT EXISTS "affiliate_referrals" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "affiliate_id" uuid NOT NULL REFERENCES "affiliates"("id") ON DELETE CASCADE,
    "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
    "commission_cents" integer NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "affiliate_withdrawals" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "affiliate_id" uuid NOT NULL REFERENCES "affiliates"("id") ON DELETE CASCADE,
    "amount_cents" integer NOT NULL,
    "pix_key" text NOT NULL,
    "pix_key_type" text NOT NULL,
    "status" text DEFAULT 'requested' NOT NULL,
    "rejection_reason" text,
    "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
    "processed_at" timestamp with time zone
  )`,

  `CREATE TABLE IF NOT EXISTS "coupons" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "code" text NOT NULL,
    "description" text,
    "discount_type" text NOT NULL,
    "discount_value" integer NOT NULL,
    "applies_to" text DEFAULT 'order' NOT NULL,
    "min_order_cents" integer DEFAULT 0 NOT NULL,
    "max_usages" integer,
    "max_usages_per_customer" integer,
    "usage_count" integer DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone,
    "affiliate_id" uuid REFERENCES "affiliates"("id") ON DELETE SET NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "coupons_code_unique" UNIQUE("code")
  )`,

  `CREATE TABLE IF NOT EXISTS "coupon_usages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "coupon_id" uuid NOT NULL REFERENCES "coupons"("id"),
    "order_id" uuid NOT NULL,
    "customer_id" uuid NOT NULL REFERENCES "customers"("id"),
    "discount_applied_cents" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "promotions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "discount_type" text NOT NULL,
    "discount_value" integer NOT NULL,
    "applies_to" text DEFAULT 'all' NOT NULL,
    "min_order_cents" integer DEFAULT 0 NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "flash_sale" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "upsell_offers" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "trigger_type" text DEFAULT 'any' NOT NULL,
    "trigger_product_id" uuid,
    "offer_type" text NOT NULL,
    "offer_product_id" uuid,
    "offer_ticket_type" text DEFAULT 'inteira',
    "offer_quantity" integer DEFAULT 1 NOT NULL,
    "original_price_cents" integer NOT NULL,
    "discount_pct" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "min_order_cents" integer DEFAULT 0 NOT NULL,
    "min_quantity" integer,
    "timer_seconds" integer DEFAULT 300 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "admin_users" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "email" text NOT NULL,
    "password_hash" text NOT NULL,
    "name" text NOT NULL,
    "role" text DEFAULT 'editor' NOT NULL,
    "permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "invited_by" uuid,
    "last_login_at" timestamp with time zone,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "admin_users_email_unique" UNIQUE("email")
  )`,

  `CREATE TABLE IF NOT EXISTS "admin_invites" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "token" text NOT NULL,
    "email" text NOT NULL,
    "name" text NOT NULL,
    "role" text DEFAULT 'editor' NOT NULL,
    "permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "invited_by" uuid NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "admin_invites_token_unique" UNIQUE("token")
  )`,

  `CREATE TABLE IF NOT EXISTS "admin_audit_log" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid,
    "user_email" text,
    "action" text NOT NULL,
    "entity" text NOT NULL,
    "entity_id" text,
    "meta" jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "ai_providers" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "provider" text NOT NULL,
    "model" text NOT NULL,
    "api_key" text NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "athlete_applications" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "full_name" text NOT NULL,
    "whatsapp" text NOT NULL,
    "email" text NOT NULL,
    "cpf" text NOT NULL,
    "rg" text NOT NULL,
    "birth_date" date NOT NULL,
    "city" text NOT NULL,
    "state" text NOT NULL,
    "photo_url" text,
    "nickname" text,
    "position" text NOT NULL,
    "dominant_foot" text NOT NULL,
    "weight_kg" text NOT NULL,
    "height_cm" text NOT NULL,
    "pix_key" text,
    "contract_start" date,
    "salary_brl" text,
    "rejection_reason" text,
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "ticket_validations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "order_id" uuid NOT NULL,
    "game_id" uuid NOT NULL,
    "ticket_quantity" integer DEFAULT 1 NOT NULL,
    "validated_by" text,
    "validated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "tv_order_game_unique" UNIQUE("order_id","game_id")
  )`,

  `CREATE TABLE IF NOT EXISTS "ticket_types" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "game_id" uuid REFERENCES "games"("id") ON DELETE CASCADE,
    "code" text NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "price_cents" integer NOT NULL,
    "combo_tiers" jsonb,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "tickets" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
    "game_id" uuid NOT NULL REFERENCES "games"("id") ON DELETE CASCADE,
    "type_code" text NOT NULL,
    "type_name" text NOT NULL,
    "unit_price_cents" integer NOT NULL,
    "status" text DEFAULT 'valid' NOT NULL,
    "validated_at" timestamp with time zone,
    "validated_by" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,


  // ── Sincronização com o schema atual (migrações 0013–0029 que não estavam
  //    aqui): sem isto, clube novo nascia sem cantina, rifa, prestação de contas,
  //    colunas usadas pelo checkout/ingressos e o índice de idempotência. ──
  `CREATE TABLE IF NOT EXISTS "accountability_reports" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "title" text NOT NULL,
    "file_url" text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "cantina_items" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "category" text DEFAULT 'outro' NOT NULL,
    "price_cents" integer NOT NULL,
    "image_url" text,
    "needs_prep" boolean DEFAULT false NOT NULL,
    "stock_cap" integer,
    "stock_sold" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "cantina_redemption_items" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "redemption_id" uuid NOT NULL,
    "voucher_id" uuid NOT NULL,
    "item_name" text NOT NULL,
    "needs_prep" boolean DEFAULT false NOT NULL,
    "qty" integer NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "cantina_redemptions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "customer_id" uuid NOT NULL,
    "game_id" uuid,
    "status" text DEFAULT 'pending' NOT NULL,
    "created_by" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "delivered_at" timestamp with time zone,
    "delivered_by" text
  )`,

  `CREATE TABLE IF NOT EXISTS "cantina_vouchers" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "order_id" uuid NOT NULL,
    "customer_id" uuid NOT NULL,
    "item_id" uuid,
    "item_name" text NOT NULL,
    "unit_price_cents" integer NOT NULL,
    "needs_prep" boolean DEFAULT false NOT NULL,
    "qty_total" integer NOT NULL,
    "qty_redeemed" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "raffle_numbers" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "raffle_id" uuid NOT NULL,
    "number" integer NOT NULL,
    "status" text DEFAULT 'available' NOT NULL,
    "order_id" uuid,
    "reserved_until" timestamp with time zone,
    "assigned_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "raffle_prizes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "raffle_id" uuid NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "image_url" text,
    "rank" integer DEFAULT 0 NOT NULL,
    "winning_number" integer,
    "winner_photo_url" text,
    "drawn_at" timestamp with time zone,
    "drawn_by" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "raffles" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "slug" text NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "image_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "number_price_cents" integer NOT NULL,
    "total_numbers" integer NOT NULL,
    "max_per_customer" integer,
    "status" text DEFAULT 'draft' NOT NULL,
    "sales_ends_at" timestamp with time zone,
    "drawn_at" timestamp with time zone,
    "active" boolean DEFAULT true NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "raffles_slug_unique" UNIQUE("slug")
  )`,

  `ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "ticket_sales_ends_at" timestamp with time zone`,

  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "game_id" uuid`,

  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fulfillment_status" text DEFAULT 'pending' NOT NULL`,

  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "pickup_code" text`,

  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp with time zone`,

  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_by" text`,

  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "service_fee_cents" integer`,

  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotency_key" text`,

  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "stock_restored" boolean DEFAULT false NOT NULL`,

  `ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "price_cents" integer`,

  `ALTER TABLE "upsell_offers" ADD COLUMN IF NOT EXISTS "offer_game_id" uuid`,

  `ALTER TABLE "ticket_types" ADD COLUMN IF NOT EXISTS "max_quantity" integer`,

  `ALTER TABLE "ticket_types" ADD COLUMN IF NOT EXISTS "sold_count" integer DEFAULT 0 NOT NULL`,

  `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "serial_no" bigserial NOT NULL`,

  `DO $$ BEGIN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,

  `DO $$ BEGIN
    ALTER TABLE "cantina_redemption_items" ADD CONSTRAINT "cantina_redemption_items_redemption_id_cantina_redemptions_id_fk" FOREIGN KEY ("redemption_id") REFERENCES "public"."cantina_redemptions"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,

  `DO $$ BEGIN
    ALTER TABLE "cantina_redemption_items" ADD CONSTRAINT "cantina_redemption_items_voucher_id_cantina_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."cantina_vouchers"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,

  `DO $$ BEGIN
    ALTER TABLE "cantina_redemptions" ADD CONSTRAINT "cantina_redemptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,

  `DO $$ BEGIN
    ALTER TABLE "cantina_redemptions" ADD CONSTRAINT "cantina_redemptions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,

  `DO $$ BEGIN
    ALTER TABLE "cantina_vouchers" ADD CONSTRAINT "cantina_vouchers_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,

  `DO $$ BEGIN
    ALTER TABLE "cantina_vouchers" ADD CONSTRAINT "cantina_vouchers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,

  `DO $$ BEGIN
    ALTER TABLE "cantina_vouchers" ADD CONSTRAINT "cantina_vouchers_item_id_cantina_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."cantina_items"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,

  `DO $$ BEGIN
    ALTER TABLE "raffle_numbers" ADD CONSTRAINT "raffle_numbers_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,

  `DO $$ BEGIN
    ALTER TABLE "raffle_numbers" ADD CONSTRAINT "raffle_numbers_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,

  `DO $$ BEGIN
    ALTER TABLE "raffle_prizes" ADD CONSTRAINT "raffle_prizes_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,

  `CREATE INDEX IF NOT EXISTS "cantina_redemption_items_redemption_idx" ON "cantina_redemption_items" USING btree ("redemption_id")`,

  `CREATE INDEX IF NOT EXISTS "cantina_vouchers_customer_idx" ON "cantina_vouchers" USING btree ("customer_id")`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "raffle_numbers_raffle_number_idx" ON "raffle_numbers" USING btree ("raffle_id","number")`,

  `CREATE INDEX IF NOT EXISTS "raffle_numbers_raffle_status_idx" ON "raffle_numbers" USING btree ("raffle_id","status")`,

  `CREATE INDEX IF NOT EXISTS "raffle_numbers_order_idx" ON "raffle_numbers" USING btree ("order_id")`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "orders_idempotency_key_idx" ON "orders" ("idempotency_key")`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "tickets_serial_no_idx" ON "tickets" ("serial_no")`,

  `CREATE INDEX IF NOT EXISTS "orders_customer_whatsapp_digits_idx" ON "orders" (regexp_replace("customer_whatsapp", '[^0-9]', '', 'g'))`,

  `CREATE INDEX IF NOT EXISTS "raffle_prizes_raffle_idx" ON "raffle_prizes" ("raffle_id")`,

  // 0030 — área logada do cliente + troca de plano de sócio
  `CREATE TABLE IF NOT EXISTS "customer_accounts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "email" text NOT NULL UNIQUE,
    "name" text NOT NULL,
    "whatsapp" text,
    "password_hash" text NOT NULL,
    "email_verified_at" timestamp with time zone,
    "password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "pending_plan_id" uuid REFERENCES "membership_plans"("id") ON DELETE SET NULL`,

  // 0031 — login da conta pelo WhatsApp (único; NULL = conta antiga só com e-mail).
  `CREATE UNIQUE INDEX IF NOT EXISTS "customer_accounts_whatsapp_idx" ON "customer_accounts" ("whatsapp")`,

  // 0032 — sócio-torcedor: destaque, promoção, ingressos grátis, detalhe por benefício,
  // mês grátis / mural e resgate de ingresso por jogo em casa.
  `ALTER TABLE "membership_plans" ADD COLUMN IF NOT EXISTS "free_tickets_per_home_game" integer DEFAULT 0 NOT NULL`,

  `ALTER TABLE "membership_plans" ADD COLUMN IF NOT EXISTS "first_month_free" boolean DEFAULT false NOT NULL`,

  `ALTER TABLE "membership_plans" ADD COLUMN IF NOT EXISTS "promo_ends_at" timestamp with time zone`,

  `ALTER TABLE "membership_plans" ADD COLUMN IF NOT EXISTS "highlight_label" text`,

  `ALTER TABLE "membership_plans" ADD COLUMN IF NOT EXISTS "card_color" text`,

  `ALTER TABLE "plan_benefits" ADD COLUMN IF NOT EXISTS "detail" text`,

  `ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp with time zone`,

  `ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "has_paid" boolean DEFAULT false NOT NULL`,

  `ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "wall_name" text`,

  `CREATE TABLE IF NOT EXISTS "member_ticket_redemptions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "member_id" uuid NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
    "game_id" uuid NOT NULL REFERENCES "games"("id") ON DELETE CASCADE,
    "seq" integer NOT NULL,
    "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "member_ticket_redemptions_member_game_seq_idx" ON "member_ticket_redemptions" ("member_id", "game_id", "seq")`,
];
