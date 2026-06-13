CREATE TABLE "coupons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL UNIQUE,
  "description" text,
  "discount_type" text NOT NULL,
  "discount_value" integer NOT NULL,
  "applies_to" text NOT NULL DEFAULT 'order',
  "min_order_cents" integer NOT NULL DEFAULT 0,
  "max_usages" integer,
  "max_usages_per_customer" integer,
  "usage_count" integer NOT NULL DEFAULT 0,
  "expires_at" timestamp with time zone,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coupon_usages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "coupon_id" uuid NOT NULL REFERENCES "coupons"("id"),
  "order_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id"),
  "discount_applied_cents" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
