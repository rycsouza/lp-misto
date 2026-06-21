import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { games } from "./content";
import { orders } from "./commerce";

/**
 * Catálogo de tipos de ingresso (Inteira, Meia, VIP, ...).
 * gameId NULL = tipo global (padrão). gameId preenchido = tipos específicos
 * daquele jogo (quando um jogo tem tipos próprios, eles substituem os globais).
 */
export const ticketTypes = pgTable("ticket_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }),
  code: text("code").notNull(), // estável: "inteira", "meia", "vip"
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Ingresso individual — uma linha por ingresso comprado (expandido por quantidade).
 * Cada ingresso tem seu próprio QR (o `id`) e status de validação independente.
 */
export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  // Snapshot do tipo no momento da compra
  typeCode: text("type_code").notNull(),
  typeName: text("type_name").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  status: text("status", { enum: ["valid", "validated", "cancelled"] })
    .notNull()
    .default("valid"),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  validatedBy: text("validated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
