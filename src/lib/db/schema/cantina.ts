import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { games } from "./content";
import { orders } from "./commerce";
import { customers } from "./customers";

/**
 * Cantina — vale pré-pago por item (substitui o "Bar" preso ao jogo).
 *
 * Conceito: o cliente compra itens QUANDO QUISER (enquanto ativos) e recebe
 * VALES (`cantina_vouchers`) que ficam na carteira dele. No dia do jogo ele
 * retira no balcão, podendo retirar PARCIALMENTE, em qualquer jogo, até
 * consumir tudo. Sem expiração.
 *
 * A compra reaproveita `orders` (type "cantina") + `payments`/webhook (igual ao
 * checkout). O vale só vale quando o pedido está `paid`.
 */

/** Catálogo à venda (sem vínculo com jogo). Cap de estoque é GLOBAL e opcional. */
export const cantinaItems = pgTable("cantina_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category", { enum: ["bebida", "comida", "outro"] })
    .notNull()
    .default("outro"),
  priceCents: integer("price_cents").notNull(),
  imageUrl: text("image_url"),
  // true = passa pela fila de preparo no momento do RESGATE (dia do jogo).
  needsPrep: boolean("needs_prep").notNull().default(false),
  // null = venda ilimitada; caso contrário esgota quando stock_sold >= stock_cap.
  stockCap: integer("stock_cap"),
  stockSold: integer("stock_sold").notNull().default(0),
  // active = listado/à venda.
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Vale = uma linha por item comprado. É o "ativo" do cliente: qty_total comprada
 * e qty_redeemed já retirada. Resgate faz UPDATE atômico
 * (SET qty_redeemed = qty_redeemed + n WHERE qty_redeemed + n <= qty_total).
 * Só conta na carteira quando o `orders.status` do pedido é `paid`.
 */
export const cantinaVouchers = pgTable(
  "cantina_vouchers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").references(() => cantinaItems.id, { onDelete: "set null" }),
    // Snapshots no momento da compra (preço/nome/preparo travados).
    itemName: text("item_name").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    needsPrep: boolean("needs_prep").notNull().default(false),
    qtyTotal: integer("qty_total").notNull(),
    qtyRedeemed: integer("qty_redeemed").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cantina_vouchers_customer_idx").on(t.customerId)]
);

/**
 * Retirada (pickup) feita no balcão, no dia do jogo. Header do evento —
 * consome N unidades de um ou mais vales. Passa por preparo se algum item
 * exigir (pending → ready → delivered).
 */
export const cantinaRedemptions = pgTable("cantina_redemptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  // Em qual jogo foi retirado (relatório). null = fora de jogo/indefinido.
  gameId: uuid("game_id").references(() => games.id, { onDelete: "set null" }),
  status: text("status", { enum: ["pending", "ready", "delivered"] })
    .notNull()
    .default("pending"),
  createdBy: text("created_by"), // operador que iniciou a retirada
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  deliveredBy: text("delivered_by"),
});

/** Linhas da retirada: quanto de cada vale foi consumido neste pickup. */
export const cantinaRedemptionItems = pgTable(
  "cantina_redemption_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    redemptionId: uuid("redemption_id")
      .notNull()
      .references(() => cantinaRedemptions.id, { onDelete: "cascade" }),
    voucherId: uuid("voucher_id")
      .notNull()
      .references(() => cantinaVouchers.id, { onDelete: "cascade" }),
    itemName: text("item_name").notNull(),
    needsPrep: boolean("needs_prep").notNull().default(false),
    qty: integer("qty").notNull(),
  },
  (t) => [index("cantina_redemption_items_redemption_idx").on(t.redemptionId)]
);
