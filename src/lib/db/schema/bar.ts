import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { games } from "./content";

/**
 * Bar Online (cashless / ficha digital).
 *
 * A "ficha" em si NÃO tem tabela própria: reaproveita `orders` (type "bar"),
 * com `orders.gameId` + `orders.serviceFeeCents` e o `fulfillmentStatus`
 * (pending = em preparo · ready = pronto · delivered = entregue). Pagamento,
 * idempotência e webhook são os mesmos do checkout atual.
 *
 * Aqui ficam só as peças genuinamente novas: o catálogo de itens e a oferta
 * (preço/estoque) por jogo.
 */

/** Catálogo reutilizável entre jogos (cerveja, espetinho, ...). */
export const barMenuItems = pgTable("bar_menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category", { enum: ["bebida", "comida", "outro"] })
    .notNull()
    .default("outro"),
  // Preço base do catálogo (pode ser sobrescrito por jogo na oferta).
  priceCents: integer("price_cents").notNull(),
  imageUrl: text("image_url"),
  // true = passa pela fila de preparo antes de a ficha ficar pronta.
  needsPrep: boolean("needs_prep").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * O que está à venda em cada jogo + estoque + preço opcional por jogo.
 * Estoque dá baixa no pagamento via UPDATE condicional atômico.
 */
export const barGameOfferings = pgTable(
  "bar_game_offerings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    menuItemId: uuid("menu_item_id")
      .notNull()
      .references(() => barMenuItems.id, { onDelete: "cascade" }),
    // null = usa o preço do catálogo (barMenuItems.priceCents).
    priceCentsOverride: integer("price_cents_override"),
    // null = estoque ilimitado; caso contrário, esgota quando sold >= total.
    stockTotal: integer("stock_total"),
    stockSold: integer("stock_sold").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("bar_game_offerings_game_item_idx").on(t.gameId, t.menuItemId)]
);
