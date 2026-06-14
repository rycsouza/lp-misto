CREATE TABLE "coupon_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"discount_applied_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
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
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ai_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"api_key" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "cpf" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "asaas_customer_id" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "subscription_id" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "next_billing_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "member_card_token" text;--> statement-breakpoint
ALTER TABLE "membership_plans" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "membership_plans" ADD COLUMN "ticket_discount_pct" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_plans" ADD COLUMN "product_discount_pct" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "upsell_offers" ADD COLUMN "offer_quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "upsell_offers" ADD COLUMN "min_quantity" integer;--> statement-breakpoint
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_member_card_token_unique" UNIQUE("member_card_token");