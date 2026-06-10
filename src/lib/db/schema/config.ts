import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const siteConfig = pgTable("site_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  type: text("type", { enum: ["string", "number", "boolean", "json"] })
    .notNull()
    .default("string"),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .$onUpdate(() => new Date()),
});
