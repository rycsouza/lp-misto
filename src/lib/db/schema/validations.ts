import { integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const ticketValidations = pgTable(
  "ticket_validations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull(),
    gameId: uuid("game_id").notNull(),
    ticketQuantity: integer("ticket_quantity").notNull().default(1),
    validatedBy: text("validated_by"),
    validatedAt: timestamp("validated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("tv_order_game_unique").on(t.orderId, t.gameId)]
);
