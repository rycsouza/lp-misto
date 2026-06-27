import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const upsellOffers = pgTable("upsell_offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),

  // What triggers the upsell
  triggerType: text("trigger_type", {
    enum: ["any", "ticket", "product", "specific_product"],
  }).notNull().default("any"),
  triggerProductId: uuid("trigger_product_id"), // only for specific_product

  // What is offered
  offerType: text("offer_type", { enum: ["ticket", "product"] }).notNull(),
  offerProductId: uuid("offer_product_id"),          // when offerType = "product"
  // Código do tipo de ingresso (ex.: "inteira", "arquibancada-descoberta") —
  // texto livre para aceitar tipos por jogo, não só os globais.
  offerTicketType: text("offer_ticket_type").default("inteira"),
  // Jogo ao qual os ingressos do upsell pertencem (obrigatório p/ offerType="ticket").
  offerGameId: uuid("offer_game_id"),
  offerQuantity: integer("offer_quantity").notNull().default(1),

  // Pricing
  originalPriceCents: integer("original_price_cents").notNull(),
  discountPct: integer("discount_pct").notNull().default(0), // 0-100

  // Config
  active: boolean("active").notNull().default(true),
  minOrderCents: integer("min_order_cents").notNull().default(0),
  minQuantity: integer("min_quantity"),
  timerSeconds: integer("timer_seconds").notNull().default(300),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type UpsellOffer = typeof upsellOffers.$inferSelect;
