import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { orders } from "./commerce";

/**
 * Sorteio/rifa. Vendas encerram por data limite (salesEndsAt), por esgotar os
 * números, ou manualmente (status "closed"). `active` = soft-delete.
 */
export const raffles = pgTable("raffles", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  // Carrossel de imagens (URLs Cloudinary).
  imageUrls: jsonb("image_urls").$type<string[]>().notNull().default([]),
  numberPriceCents: integer("number_price_cents").notNull(),
  totalNumbers: integer("total_numbers").notNull(),
  maxPerCustomer: integer("max_per_customer"), // null = sem limite
  status: text("status", {
    enum: ["draft", "active", "closed", "drawn", "cancelled"],
  })
    .notNull()
    .default("draft"),
  salesEndsAt: timestamp("sales_ends_at", { withTimezone: true }), // null = sem data limite
  drawnAt: timestamp("drawn_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Número individual da rifa — 1 linha por número, pré-gerada na ativação.
 * Atribuição sem transação: um único UPDATE ... ORDER BY random() LIMIT n
 * FOR UPDATE SKIP LOCKED RETURNING garante unicidade e resolve corrida.
 * Ciclo: available → reserved (no PIX, com reservedUntil) → sold (no pagamento).
 */
export const raffleNumbers = pgTable(
  "raffle_numbers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    raffleId: uuid("raffle_id")
      .notNull()
      .references(() => raffles.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    status: text("status", { enum: ["available", "reserved", "sold"] })
      .notNull()
      .default("available"),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    reservedUntil: timestamp("reserved_until", { withTimezone: true }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("raffle_numbers_raffle_number_idx").on(t.raffleId, t.number),
    index("raffle_numbers_raffle_status_idx").on(t.raffleId, t.status),
    index("raffle_numbers_order_idx").on(t.orderId),
  ]
);

/**
 * Prêmio do sorteio (1º, 2º, 3º...). Vários por rifa ⇒ vários ganhadores.
 * O ganhador é definido pelo operador informando o número sorteado; o comprador
 * é resolvido via raffle_numbers (raffleId + winningNumber) → order.
 */
export const rafflePrizes = pgTable("raffle_prizes", {
  id: uuid("id").primaryKey().defaultRandom(),
  raffleId: uuid("raffle_id")
    .notNull()
    .references(() => raffles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  rank: integer("rank").notNull().default(0), // ordem/posição (1º, 2º, ...)
  // Ganhador (preenchido no sorteio):
  winningNumber: integer("winning_number"), // número sorteado
  winnerPhotoUrl: text("winner_photo_url"), // foto opcional do ganhador (operador)
  drawnAt: timestamp("drawn_at", { withTimezone: true }),
  drawnBy: text("drawn_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
