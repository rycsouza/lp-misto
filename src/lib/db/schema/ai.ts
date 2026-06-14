import { pgTable, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";

export const aiProviders = pgTable("ai_providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  provider: text("provider").notNull(), // "anthropic" | "openai"
  model: text("model").notNull(),
  apiKey: text("api_key").notNull(), // encrypted
  active: boolean("active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type AIProviderRow = typeof aiProviders.$inferSelect;
