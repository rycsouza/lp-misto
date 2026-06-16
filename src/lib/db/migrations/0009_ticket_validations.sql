CREATE TABLE "ticket_validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"ticket_quantity" integer NOT NULL DEFAULT 1,
	"validated_by" text,
	"validated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tv_order_game_unique" UNIQUE("order_id","game_id")
);
