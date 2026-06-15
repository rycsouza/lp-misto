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
  icon: text("icon").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  ticketDiscountPct: integer("ticket_discount_pct").notNull().default(0),
  productDiscountPct: integer("product_discount_pct").notNull().default(0),
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
  cpf: text("cpf"),
  planId: uuid("plan_id").references(() => membershipPlans.id, { onDelete: "set null" }),
  status: text("status", { enum: ["pending", "active", "cancelled"] })
    .notNull()
    .default("pending"),
  // Subscription tracking (gateway-agnostic)
  gatewaySlug: text("gateway_slug"),
  gatewayCustomerId: text("gateway_customer_id"),
  asaasCustomerId: text("asaas_customer_id"), // kept for backward compat
  subscriptionId: text("subscription_id"),
  nextBillingDate: timestamp("next_billing_date", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  // Digital membership card
  memberCardToken: text("member_card_token").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
