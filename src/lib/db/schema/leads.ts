import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    whatsapp: text("whatsapp"),
    source: text("source", {
      enum: [
        "ticket_checkout",
        "membership_interest",
        "sponsorship_interest",
        "newsletter",
        "history_gallery",
      ],
    }).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("leads_email_source_idx").on(table.email, table.source)]
);
