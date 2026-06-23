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
    "payment_methods" text[] DEFAULT ARRAY['pix','credit_card'],
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
];
