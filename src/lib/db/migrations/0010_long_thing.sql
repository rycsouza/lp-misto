CREATE TABLE "product_waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"whatsapp" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotions" (
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
);
--> statement-breakpoint
CREATE TABLE "affiliate_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"commission_cents" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"pix_key" text NOT NULL,
	"pix_key_type" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"rejection_reason" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "affiliates" (
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
);
--> statement-breakpoint
CREATE TABLE "athlete_applications" (
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
);
--> statement-breakpoint
CREATE TABLE "ticket_validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"ticket_quantity" integer DEFAULT 1 NOT NULL,
	"validated_by" text,
	"validated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tv_order_game_unique" UNIQUE("order_id","game_id")
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "affiliate_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "affiliate_code" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sale_price_cents" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sale_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "coming_soon" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "gateway_slug" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "gateway_customer_id" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "affiliate_code" text;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "affiliate_id" uuid;--> statement-breakpoint
ALTER TABLE "product_waitlist" ADD CONSTRAINT "product_waitlist_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_withdrawals" ADD CONSTRAINT "affiliate_withdrawals_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE set null ON UPDATE no action;