/**
 * Membership — fora do escopo v1.
 * Schema definido para seed de referência e implementação futura (v2).
 */
import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { leads } from "./leads";

export const membershipPlans = pgTable("membership_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  icon: text("icon").notNull(), // nome do ícone Lucide
  priceCents: integer("price_cents").notNull(),
  highlight: boolean("highlight").notNull().default(false),
  active: boolean("active").notNull().default(true),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const membershipBenefits = pgTable("membership_benefits", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const planBenefits = pgTable(
  "plan_benefits",
  {
    planId: uuid("plan_id")
      .notNull()
      .references(() => membershipPlans.id, { onDelete: "cascade" }),
    benefitId: uuid("benefit_id")
      .notNull()
      .references(() => membershipBenefits.id, { onDelete: "cascade" }),
    included: boolean("included").notNull().default(true),
  },
  (table) => [primaryKey({ columns: [table.planId, table.benefitId] })]
);

export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  whatsapp: text("whatsapp"),
  planId: uuid("plan_id").references(() => membershipPlans.id, { onDelete: "set null" }),
  status: text("status", { enum: ["pending", "active", "cancelled"] })
    .notNull()
    .default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
