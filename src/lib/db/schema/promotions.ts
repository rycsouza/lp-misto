import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const promotions = pgTable("promotions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  discountType: text("discount_type", { enum: ["pct", "fixed"] }).notNull(),
  discountValue: integer("discount_value").notNull(),
  appliesTo: text("applies_to", { enum: ["all", "tickets", "products"] })
    .notNull()
    .default("all"),
  minOrderCents: integer("min_order_cents").notNull().default(0),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  active: boolean("active").notNull().default(true),
  flashSale: boolean("flash_sale").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
