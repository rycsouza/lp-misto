import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { leads } from "./leads";
import { games } from "./content";
import { orders } from "./commerce";

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
  // Etiqueta do destaque (ex.: "MAIS POPULAR"). NULL → texto padrão na vitrine.
  highlightLabel: text("highlight_label"),
  // Cor do cartão na vitrine (#RRGGBB). NULL → cor primária do clube.
  cardColor: text("card_color"),
  // Ingressos grátis por jogo em casa (resgatados pelo sócio na área logada).
  freeTicketsPerHomeGame: integer("free_tickets_per_home_game").notNull().default(0),
  // Promoção "1º mês grátis" (só cartão). promoEndsAt NULL = sem data-limite.
  firstMonthFree: boolean("first_month_free").notNull().default(false),
  promoEndsAt: timestamp("promo_ends_at", { withTimezone: true }),
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
    // Valor específico do plano para este benefício (ex.: "3 segundos").
    detail: text("detail"),
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
  // Troca de plano agendada: vira planId quando a 1ª mensalidade da nova
  // assinatura é paga (no próximo vencimento).
  pendingPlanId: uuid("pending_plan_id").references(() => membershipPlans.id, { onDelete: "set null" }),
  // Texto livre no banco (sem enum/check) — "suspended" não exige migração.
  status: text("status", { enum: ["pending", "active", "suspended", "cancelled"] })
    .notNull()
    .default("pending"),
  // Subscription tracking (gateway-agnostic)
  gatewaySlug: text("gateway_slug"),
  gatewayCustomerId: text("gateway_customer_id"),
  asaasCustomerId: text("asaas_customer_id"), // kept for backward compat
  subscriptionId: text("subscription_id"),
  nextBillingDate: timestamp("next_billing_date", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  // Affiliate tracking
  affiliateCode: text("affiliate_code"),
  // Digital membership card
  memberCardToken: text("member_card_token").unique(),
  // Promoção 1º mês grátis: fim do mês grátis (NULL = sem promoção).
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  // Já teve alguma mensalidade paga. Gravado na ativação por pagamento confirmado.
  hasPaid: boolean("has_paid").notNull().default(false),
  // Nome exibido no mural dos sócios (NULL = não aparece; opt-in).
  wallName: text("wall_name"),
  // Última sincronização do ledger de mensalidades (ordena o lote do cron/backfill).
  ledgerSyncedAt: timestamp("ledger_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Ingresso grátis do plano por jogo em casa. `seq` (1..N) é a posição do resgate
 * naquele jogo; a unique (memberId, gameId, seq) garante o limite sem corrida.
 */
export const memberTicketRedemptions = pgTable(
  "member_ticket_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("member_ticket_redemptions_member_game_seq_idx").on(
      table.memberId,
      table.gameId,
      table.seq
    ),
  ]
);

/** Status normalizados das mensalidades (ver membership/ledger-status.ts). */
export const MEMBERSHIP_PAYMENT_STATUSES = [
  "pending",
  "confirmed",
  "received",
  "overdue",
  "refunded",
  "chargeback",
  "cancelled",
] as const;
export type MembershipPaymentStatusValue = (typeof MEMBERSHIP_PAYMENT_STATUSES)[number];

/**
 * Ledger local das mensalidades do sócio-torcedor (espelho do gateway, para os
 * relatórios). Os valores vêm SEMPRE de uma reconsulta ao gateway. `gateway_payment_id`
 * é único: o upsert por ele torna a gravação idempotente. `plan_id` é o plano vigente
 * na 1ª gravação da cobrança e não muda depois.
 */
export const membershipPayments = pgTable(
  "membership_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    planId: uuid("plan_id").references(() => membershipPlans.id, { onDelete: "set null" }),
    gatewaySlug: text("gateway_slug"),
    gatewayPaymentId: text("gateway_payment_id").notNull(),
    subscriptionId: text("subscription_id"),
    valueCents: integer("value_cents").notNull(),
    // Líquido após a taxa do gateway (NULL quando o gateway não informa).
    netValueCents: integer("net_value_cents"),
    status: text("status", { enum: MEMBERSHIP_PAYMENT_STATUSES }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    billingType: text("billing_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("membership_payments_gateway_payment_id_idx").on(table.gatewayPaymentId),
    index("membership_payments_paid_at_idx").on(table.paidAt),
    index("membership_payments_member_id_idx").on(table.memberId),
    index("membership_payments_status_idx").on(table.status),
  ]
);
