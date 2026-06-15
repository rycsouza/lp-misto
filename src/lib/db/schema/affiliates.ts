import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { orders } from "./commerce";

export const affiliates = pgTable("affiliates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  whatsapp: text("whatsapp"),
  code: text("code").notNull().unique(),
  commissionType: text("commission_type", { enum: ["pct", "fixed"] }).notNull().default("pct"),
  commissionValue: integer("commission_value").notNull().default(10),
  active: boolean("active").notNull().default(true),
  loginToken: text("login_token"),
  loginTokenExpiresAt: timestamp("login_token_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const affiliateReferrals = pgTable("affiliate_referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  affiliateId: uuid("affiliate_id")
    .notNull()
    .references(() => affiliates.id, { onDelete: "cascade" }),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  commissionCents: integer("commission_cents").notNull(),
  status: text("status", { enum: ["pending", "paid", "cancelled"] })
    .notNull()
    .default("pending"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const affiliateWithdrawals = pgTable("affiliate_withdrawals", {
  id: uuid("id").primaryKey().defaultRandom(),
  affiliateId: uuid("affiliate_id")
    .notNull()
    .references(() => affiliates.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  pixKey: text("pix_key").notNull(),
  pixKeyType: text("pix_key_type", { enum: ["cpf", "cnpj", "email", "phone", "random"] }).notNull(),
  status: text("status", { enum: ["requested", "processing", "paid", "rejected"] })
    .notNull()
    .default("requested"),
  rejectionReason: text("rejection_reason"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});
