import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { affiliates } from "./affiliates";

export const coupons = pgTable("coupons", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  description: text("description"),
  discountType: text("discount_type", { enum: ["pct", "fixed"] }).notNull(),
  discountValue: integer("discount_value").notNull(),
  appliesTo: text("applies_to", { enum: ["order", "tickets", "products"] }).notNull().default("order"),
  minOrderCents: integer("min_order_cents").notNull().default(0),
  maxUsages: integer("max_usages"),
  maxUsagesPerCustomer: integer("max_usages_per_customer"),
  usageCount: integer("usage_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  affiliateId: uuid("affiliate_id").references(() => affiliates.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const couponUsages = pgTable("coupon_usages", {
  id: uuid("id").primaryKey().defaultRandom(),
  couponId: uuid("coupon_id").notNull().references(() => coupons.id),
  orderId: uuid("order_id").notNull(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  discountAppliedCents: integer("discount_applied_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Coupon = typeof coupons.$inferSelect;
export type CouponUsage = typeof couponUsages.$inferSelect;
