ALTER TABLE "upsell_offers" ADD COLUMN "offer_quantity" integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE "upsell_offers" ADD COLUMN "min_quantity" integer;
