"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getDb } from "@/lib/db/client";
import {
  orders,
  orderItems,
  payments,
  games,
  siteConfig,
  paymentGateways,
  members,
  membershipPlans,
  promotions,
  affiliateReferrals,
  products,
  productVariants,
} from "@/lib/db/schema";
import {
  eq,
  ne,
  desc,
  asc,
  ilike,
  and,
  or,
  sql,
  count,
  gte,
  lt,
  inArray,
  isNotNull,
} from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/payment/encryption";
import { getPaymentGatewayBySlug } from "@/lib/payment";
import type { PaymentGateway } from "@/lib/payment";
import { applyGatewayStatus } from "@/lib/payment/sync";
import { logAudit } from "@/lib/audit";
import { startOfDayBrasilia, todayBrasilia } from "@/lib/date";
import { getAdminSession } from "./admin-auth";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AdminStats {
  totalRevenueTodayCents: number;
  totalRevenueMonthCents: number;
  ordersToday: number;
  ordersPending: number;
  ordersPaid: number;
  ordersCancelled: number;
  revenueChartData: { date: string; cents: number }[];
  membersActive: number;
  membersPending: number;
  membershipMRRCents: number;
  affiliatePendingCommissionCents: number;
  activePromotions: number;
}

export interface RecentOrderRow {
  id: string;
  customerName: string;
  customerEmail: string;
  status: string;
  totalCents: number;
  paymentMethod: string;
  createdAt: Date;
}

export interface OrderRow {
  id: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  status: string;
  displayStatus: string;
  totalCents: number;
  createdAt: Date;
  paymentStatus: string | null;
  gatewaySlug: string | null;
  pixExpiresAt: Date | null;
}

export interface OrderItemRow {
  id: string;
  type: string;
  referenceId: string | null;
  quantity: number;
  unitPriceCents: number;
  metadata: unknown;
  imageUrl: string | null;
  game: { opponent: string; date: Date; competition: string | null; venue: string | null } | null;
}

export interface OrderPaymentRow {
  id: string;
  gatewaySlug: string;
  gatewayPaymentId: string | null;
  status: string;
  amountCents: number;
  pixQrCode: string | null;
  pixQrCodeUrl: string | null;
  pixExpiresAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}

export interface OrderDetail {
  id: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  status: string;
  displayStatus: string;
  totalCents: number;
  pickupInfo: string | null;
  shippingAddress: Record<string, string> | null;
  shippingCostCents: number | null;
  shippingServiceName: string | null;
  createdAt: Date;
  items: OrderItemRow[];
  payment: OrderPaymentRow | null;
}

export interface GameInput {
  season: number;
  competition: string;
  round: string;
  date: Date;
  isHome: boolean;
  opponent: string;
  opponentCrestUrl?: string | null;
  venue: string;
  ticketPriceInteiraCents?: number | null;
  ticketPriceMeiaCents?: number | null;
  meiaEligibilityLabel?: string | null;
  active: boolean;
}

export interface SiteConfigRow {
  key: string;
  value: string;
  type: string;
  description: string | null;
}

const PENDING_EXPIRY_MS = 30 * 60 * 1000;

function computeDisplayStatus(status: string, createdAt: Date): string {
  if (status === "pending" && Date.now() - new Date(createdAt).getTime() > PENDING_EXPIRY_MS) {
    return "cancelled";
  }
  return status;
}

// ─── DASHBOARD STATS ────────────────────────────────────────────────────────

// Cortesias têm whatsapp "00000000000" — excluímos de todas as métricas de vendas
const NOT_COURTESY = ne(orders.customerWhatsapp, "00000000000");

export async function getAdminStats(): Promise<AdminStats> {
  const db = await getDb();
  const now = new Date();
  const startOfToday = startOfDayBrasilia(0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Revenue today (paid orders only, excluding courtesy)
  const [revTodayRow] = await db
    .select({ total: sql<number>`coalesce(sum(${orders.totalCents}), 0)` })
    .from(orders)
    .where(and(eq(orders.status, "paid"), gte(orders.createdAt, startOfToday), NOT_COURTESY));

  // Revenue this month (excluding courtesy)
  const [revMonthRow] = await db
    .select({ total: sql<number>`coalesce(sum(${orders.totalCents}), 0)` })
    .from(orders)
    .where(
      and(eq(orders.status, "paid"), gte(orders.createdAt, startOfMonth), NOT_COURTESY)
    );

  // Orders today (all statuses, excluding courtesy)
  const [ordersTodayRow] = await db
    .select({ total: count() })
    .from(orders)
    .where(and(gte(orders.createdAt, startOfToday), NOT_COURTESY));

  // Orders by status (all time, excluding courtesy)
  const statusCounts = await db
    .select({ status: orders.status, total: count() })
    .from(orders)
    .where(NOT_COURTESY)
    .groupBy(orders.status);

  const pendingCount =
    statusCounts.find((r) => r.status === "pending")?.total ?? 0;
  const paidCount = statusCounts.find((r) => r.status === "paid")?.total ?? 0;
  const cancelledCount =
    statusCounts.find((r) => r.status === "cancelled")?.total ?? 0;

  // Chart data: last 7 days — single query instead of 7 roundtrips
  const sevenDaysAgo = startOfDayBrasilia(6);
  const chartDbRows = await db
    .select({
      day: sql<string>`(${orders.createdAt} AT TIME ZONE 'America/Sao_Paulo')::date::text`,
      cents: sql<number>`coalesce(sum(${orders.totalCents}), 0)`,
    })
    .from(orders)
    .where(and(eq(orders.status, "paid"), gte(orders.createdAt, sevenDaysAgo), NOT_COURTESY))
    .groupBy(sql`(${orders.createdAt} AT TIME ZONE 'America/Sao_Paulo')::date`)
    .orderBy(sql`(${orders.createdAt} AT TIME ZONE 'America/Sao_Paulo')::date`);

  const centsMap = new Map(chartDbRows.map((r) => [r.day, Number(r.cents)]));

  const chartData: { date: string; cents: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = startOfDayBrasilia(i);
    const dayKey = dayStart.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    chartData.push({
      date: dayStart.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo",
      }),
      cents: centsMap.get(dayKey) ?? 0,
    });
  }

  // Member counts by status
  const memberCounts = await db
    .select({ status: members.status, total: count() })
    .from(members)
    .groupBy(members.status);

  const membersActive = memberCounts.find((r) => r.status === "active")?.total ?? 0;
  const membersPending = memberCounts.find((r) => r.status === "pending")?.total ?? 0;

  // Membership MRR: sum plan prices of all active members
  const [mrrRow] = await db
    .select({ total: sql<number>`coalesce(sum(${membershipPlans.priceCents}), 0)` })
    .from(members)
    .innerJoin(membershipPlans, eq(members.planId, membershipPlans.id))
    .where(eq(members.status, "active"));

  // Affiliate pending commissions
  const [affiliatePendingRow] = await db
    .select({ total: sql<number>`coalesce(sum(${affiliateReferrals.commissionCents}), 0)` })
    .from(affiliateReferrals)
    .where(eq(affiliateReferrals.status, "pending"));

  // Active promotions (active flag + within date range)
  const [activePromoRow] = await db
    .select({ total: count() })
    .from(promotions)
    .where(
      and(
        eq(promotions.active, true),
        gte(promotions.endsAt, now),
        lt(promotions.startsAt, now)
      )
    );

  return {
    totalRevenueTodayCents: Number(revTodayRow.total),
    totalRevenueMonthCents: Number(revMonthRow.total),
    ordersToday: Number(ordersTodayRow.total),
    ordersPending: Number(pendingCount),
    ordersPaid: Number(paidCount),
    ordersCancelled: Number(cancelledCount),
    revenueChartData: chartData,
    membersActive: Number(membersActive),
    membersPending: Number(membersPending),
    membershipMRRCents: Number(mrrRow.total),
    affiliatePendingCommissionCents: Number(affiliatePendingRow.total),
    activePromotions: Number(activePromoRow.total),
  };
}

// ─── SALES REPORT ───────────────────────────────────────────────────────────

export interface SalesReport {
  range: { from: string; to: string };
  // KPIs (apenas pedidos pagos no período)
  revenueCents: number;
  paidOrders: number;
  avgTicketCents: number;
  ticketsSold: number;
  byTicketType: { label: string; qty: number }[];
  productsSold: number;
  // Receita bruta por categoria
  ticketRevenueCents: number;
  productRevenueCents: number;
  raffleRevenueCents: number;
  discountsCents: number; // valor negativo (descontos aplicados)
  // Séries e rankings
  dailyRevenue: { date: string; cents: number }[];
  byGame: { label: string; qty: number; cents: number }[];
  topProducts: { label: string; qty: number; cents: number }[];
  // Comparativo simples de status no período
  ordersByStatus: { status: string; total: number }[];
}

/** Converte "YYYY-MM-DD" (Brasília) em Date UTC no início/fim do dia. */
function brasiliaDayBounds(from: string, to: string): { start: Date; end: Date } {
  return {
    start: new Date(`${from}T00:00:00-03:00`),
    end: new Date(`${to}T23:59:59.999-03:00`),
  };
}

export async function getSalesReport(params: {
  from?: string;
  to?: string;
} = {}): Promise<SalesReport> {
  const db = await getDb();
  const today = todayBrasilia();
  const defaultFrom = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(Date.now() - 29 * 86_400_000));
  const from = params.from || defaultFrom;
  const to = params.to || today;
  const { start, end } = brasiliaDayBounds(from, to);

  const paidInRange = and(
    eq(orders.status, "paid"),
    gte(orders.createdAt, start),
    lt(orders.createdAt, new Date(end.getTime() + 1))
  );

  // KPIs de pedidos pagos
  const [kpiRow] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${orders.totalCents}), 0)`,
      orders: count(),
    })
    .from(orders)
    .where(paidInRange);

  const revenueCents = Number(kpiRow.revenue);
  const paidOrders = Number(kpiRow.orders);

  // Itens dos pedidos pagos no período
  const [itemAgg] = await db
    .select({
      ticketRevenue: sql<number>`coalesce(sum(case when ${orderItems.type} = 'ticket' and ${orderItems.unitPriceCents} >= 0 then ${orderItems.quantity} * ${orderItems.unitPriceCents} else 0 end), 0)`,
      productRevenue: sql<number>`coalesce(sum(case when ${orderItems.type} = 'product' and ${orderItems.unitPriceCents} >= 0 then ${orderItems.quantity} * ${orderItems.unitPriceCents} else 0 end), 0)`,
      raffleRevenue: sql<number>`coalesce(sum(case when ${orderItems.type} = 'raffle' and ${orderItems.unitPriceCents} >= 0 then ${orderItems.quantity} * ${orderItems.unitPriceCents} else 0 end), 0)`,
      discounts: sql<number>`coalesce(sum(case when ${orderItems.unitPriceCents} < 0 then ${orderItems.quantity} * ${orderItems.unitPriceCents} else 0 end), 0)`,
      ticketsSold: sql<number>`coalesce(sum(case when ${orderItems.type} = 'ticket' and ${orderItems.unitPriceCents} >= 0 then ${orderItems.quantity} else 0 end), 0)`,
      productsSold: sql<number>`coalesce(sum(case when ${orderItems.type} = 'product' and ${orderItems.unitPriceCents} >= 0 then ${orderItems.quantity} else 0 end), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(paidInRange);

  // Ingressos vendidos por tipo (dinâmico): usa typeName quando existe, senão o code
  const ticketTypeLabelExpr = sql<string>`coalesce(${orderItems.metadata}->>'typeName', initcap(${orderItems.metadata}->>'ticketType'), 'Ingresso')`;
  const byTicketTypeRows = await db
    .select({
      label: ticketTypeLabelExpr,
      qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(paidInRange, eq(orderItems.type, "ticket"), gte(orderItems.unitPriceCents, 0)))
    .groupBy(ticketTypeLabelExpr)
    .orderBy(desc(sql`sum(${orderItems.quantity})`));
  const byTicketType = byTicketTypeRows.map((r) => ({
    label: r.label,
    qty: Number(r.qty),
  }));

  // Receita diária (pedidos pagos)
  const dayExpr = sql<string>`(${orders.createdAt} AT TIME ZONE 'America/Sao_Paulo')::date::text`;
  const dailyRows = await db
    .select({
      day: dayExpr,
      cents: sql<number>`coalesce(sum(${orders.totalCents}), 0)`,
    })
    .from(orders)
    .where(paidInRange)
    .groupBy(dayExpr)
    .orderBy(dayExpr);

  // Série diária contínua: preenche com 0 os dias do período sem vendas
  const centsByDay = new Map(dailyRows.map((r) => [r.day, Number(r.cents)]));
  const dailyRevenue: { date: string; cents: number }[] = [];
  const lastDay = new Date(`${to}T12:00:00-03:00`).getTime();
  let cursor = new Date(`${from}T12:00:00-03:00`).getTime();
  let guard = 0;
  while (cursor <= lastDay && guard < 370) {
    const d = new Date(cursor);
    const key = d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    dailyRevenue.push({
      date: d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo",
      }),
      cents: centsByDay.get(key) ?? 0,
    });
    cursor += 86_400_000;
    guard++;
  }

  // Vendas por jogo (ingressos)
  const byGameRows = await db
    .select({
      opponent: games.opponent,
      competition: games.competition,
      qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
      cents: sql<number>`coalesce(sum(${orderItems.quantity} * ${orderItems.unitPriceCents}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(games, eq(orderItems.referenceId, games.id))
    .where(and(paidInRange, eq(orderItems.type, "ticket")))
    .groupBy(games.opponent, games.competition)
    .orderBy(desc(sql`sum(${orderItems.quantity} * ${orderItems.unitPriceCents})`))
    .limit(20);

  const byGame = byGameRows.map((r) => ({
    label: `vs ${r.opponent}${r.competition ? ` · ${r.competition}` : ""}`,
    qty: Number(r.qty),
    cents: Number(r.cents),
  }));

  // Top produtos (por nome no metadata)
  const productNameExpr = sql<string>`coalesce(${orderItems.metadata}->>'name', 'Produto')`;
  const topProductRows = await db
    .select({
      name: productNameExpr,
      qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
      cents: sql<number>`coalesce(sum(${orderItems.quantity} * ${orderItems.unitPriceCents}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(paidInRange, eq(orderItems.type, "product"), gte(orderItems.unitPriceCents, 0))
    )
    .groupBy(productNameExpr)
    .orderBy(desc(sql`sum(${orderItems.quantity} * ${orderItems.unitPriceCents})`))
    .limit(20);

  const topProducts = topProductRows.map((r) => ({
    label: r.name,
    qty: Number(r.qty),
    cents: Number(r.cents),
  }));

  // Pedidos por status no período (todos os status)
  const statusRows = await db
    .select({ status: orders.status, total: count() })
    .from(orders)
    .where(
      and(
        gte(orders.createdAt, start),
        lt(orders.createdAt, new Date(end.getTime() + 1))
      )
    )
    .groupBy(orders.status);

  return {
    range: { from, to },
    revenueCents,
    paidOrders,
    avgTicketCents: paidOrders > 0 ? Math.round(revenueCents / paidOrders) : 0,
    ticketsSold: Number(itemAgg.ticketsSold),
    byTicketType,
    productsSold: Number(itemAgg.productsSold),
    ticketRevenueCents: Number(itemAgg.ticketRevenue),
    productRevenueCents: Number(itemAgg.productRevenue),
    raffleRevenueCents: Number(itemAgg.raffleRevenue),
    discountsCents: Number(itemAgg.discounts),
    dailyRevenue,
    byGame,
    topProducts,
    ordersByStatus: statusRows.map((r) => ({
      status: r.status,
      total: Number(r.total),
    })),
  };
}

export async function getRecentOrders(
  limit = 10
): Promise<RecentOrderRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: orders.id,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      status: orders.status,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
      gatewaySlug: payments.gatewaySlug,
    })
    .from(orders)
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .orderBy(desc(orders.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    status: r.status,
    totalCents: r.totalCents,
    paymentMethod: r.gatewaySlug ?? "pix",
    createdAt: r.createdAt,
  }));
}

// ─── ORDERS ─────────────────────────────────────────────────────────────────

export async function getAdminOrders(params: {
  page: number;
  status?: string;
  search?: string;
  limit?: number;
  excludeCourtesy?: boolean;
}): Promise<{ rows: OrderRow[]; total: number }> {
  const db = await getDb();
  const { page, status, search, limit = 20, excludeCourtesy = true } = params;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (excludeCourtesy) {
    conditions.push(NOT_COURTESY);
  }

  if (status && status !== "all") {
    conditions.push(
      eq(
        orders.status,
        status as "pending" | "paid" | "cancelled" | "refunded"
      )
    );
  }

  if (search && search.trim()) {
    const pattern = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(orders.customerName, pattern),
        ilike(orders.customerEmail, pattern),
        ilike(orders.customerWhatsapp, pattern)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ total: count() })
    .from(orders)
    .where(whereClause);

  const rows = await db
    .select({
      id: orders.id,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      customerWhatsapp: orders.customerWhatsapp,
      status: orders.status,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
      paymentStatus: payments.status,
      gatewaySlug: payments.gatewaySlug,
      pixExpiresAt: payments.pixExpiresAt,
    })
    .from(orders)
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .where(whereClause)
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      customerName: r.customerName,
      customerEmail: r.customerEmail,
      customerWhatsapp: r.customerWhatsapp,
      status: r.status,
      displayStatus: computeDisplayStatus(r.status, r.createdAt),
      totalCents: r.totalCents,
      createdAt: r.createdAt,
      paymentStatus: r.paymentStatus ?? null,
      gatewaySlug: r.gatewaySlug ?? null,
      pixExpiresAt: r.pixExpiresAt ?? null,
    })),
    total: Number(totalRow.total),
  };
}

export async function getAdminOrderDetail(
  id: string
): Promise<OrderDetail | null> {
  const db = await getDb();
  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (!orderRows[0]) return null;

  const order = orderRows[0];

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, id))
    .orderBy(asc(orderItems.createdAt));

  // Fetch images and game data for items
  const productItems = items.filter((i) => i.type === "product" && i.referenceId);
  const ticketItems = items.filter((i) => i.type === "ticket" && i.referenceId);
  const productIds = [...new Set(productItems.map((i) => i.referenceId!))];
  const variantIds = [
    ...new Set(
      productItems
        .map((i) => (i.metadata as Record<string, unknown> | null)?.variantId as string | undefined)
        .filter((v): v is string => !!v)
    ),
  ];
  const gameIds = [...new Set(ticketItems.map((i) => i.referenceId!))];

  const [productRows, variantRows, gameRows, paymentRows] = await Promise.all([
    productIds.length > 0
      ? db.select({ id: products.id, imageUrl: products.imageUrl }).from(products).where(inArray(products.id, productIds))
      : Promise.resolve([]),
    variantIds.length > 0
      ? db.select({ id: productVariants.id, colorImageUrl: productVariants.colorImageUrl }).from(productVariants).where(inArray(productVariants.id, variantIds))
      : Promise.resolve([]),
    gameIds.length > 0
      ? db.select({ id: games.id, opponent: games.opponent, date: games.date, competition: games.competition, venue: games.venue }).from(games).where(inArray(games.id, gameIds))
      : Promise.resolve([]),
    db.select().from(payments).where(eq(payments.orderId, id)).limit(1),
  ]);

  const productImageMap = Object.fromEntries(productRows.map((p) => [p.id, p.imageUrl]));
  const variantImageMap = Object.fromEntries(variantRows.map((v) => [v.id, v.colorImageUrl]));
  const gameMap = Object.fromEntries(gameRows.map((g) => [g.id, g]));

  const payment = paymentRows[0] ?? null;

  return {
    id: order.id,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerWhatsapp: order.customerWhatsapp,
    status: order.status,
    displayStatus: computeDisplayStatus(order.status, order.createdAt),
    totalCents: order.totalCents,
    pickupInfo: order.pickupInfo ?? null,
    shippingAddress: (order.shippingAddress as Record<string, string> | null) ?? null,
    shippingCostCents: order.shippingCostCents ?? null,
    shippingServiceName: order.shippingServiceName ?? null,
    createdAt: order.createdAt,
    items: items.map((item) => {
      const meta = item.metadata as Record<string, unknown> | null;
      const variantId = meta?.variantId as string | undefined;
      const imageUrl =
        (variantId ? variantImageMap[variantId] : null) ??
        (item.referenceId ? productImageMap[item.referenceId] : null) ??
        null;
      const game =
        item.type === "ticket" && item.referenceId
          ? (gameMap[item.referenceId] ?? null)
          : null;
      return {
        id: item.id,
        type: item.type,
        referenceId: item.referenceId ?? null,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        metadata: item.metadata,
        imageUrl,
        game,
      };
    }),
    payment: payment
      ? {
          id: payment.id,
          gatewaySlug: payment.gatewaySlug,
          gatewayPaymentId: payment.gatewayPaymentId ?? null,
          status: payment.status,
          amountCents: payment.amountCents,
          pixQrCode: payment.pixQrCode ?? null,
          pixQrCodeUrl: payment.pixQrCodeUrl ?? null,
          pixExpiresAt: payment.pixExpiresAt ?? null,
          paidAt: payment.paidAt ?? null,
          createdAt: payment.createdAt,
        }
      : null,
  };
}

export async function updateOrderStatusAdmin(
  orderId: string,
  status: "paid" | "cancelled" | "refunded"
): Promise<void> {
  const db = await getDb();
  const session = await getAdminSession();
  if (!session || (session.role !== "admin" && !session.permissions["pedidos"])) {
    throw new Error("Não autorizado.");
  }
  await db.update(orders).set({ status }).where(eq(orders.id, orderId));

  if (status === "paid") {
    await db
      .update(payments)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(payments.orderId, orderId));
  }

  await logAudit("update_order_status", "order", orderId, { status });
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${orderId}`);
}

// ─── GAMES ──────────────────────────────────────────────────────────────────

export interface GameRow {
  id: string;
  season: number;
  competition: string;
  round: string;
  date: Date;
  isHome: boolean;
  opponent: string;
  opponentCrestUrl: string | null;
  venue: string;
  ticketPriceInteiraCents: number | null;
  ticketPriceMeiaCents: number | null;
  meiaEligibilityLabel: string | null;
  active: boolean;
}

export async function getAdminGames(params: {
  season?: number;
  search?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{ rows: GameRow[]; total: number }> {
  const db = await getDb();
  const { season, search, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (season) conditions.push(eq(games.season, season));
  if (search?.trim()) {
    const pat = `%${search.trim()}%`;
    conditions.push(
      or(ilike(games.opponent, pat), ilike(games.competition, pat), ilike(games.round, pat))
    );
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ total: count() }).from(games).where(whereClause);
  const rows = await db
    .select({
      id: games.id,
      season: games.season,
      competition: games.competition,
      round: games.round,
      date: games.date,
      isHome: games.isHome,
      opponent: games.opponent,
      opponentCrestUrl: games.opponentCrestUrl,
      venue: games.venue,
      ticketPriceInteiraCents: games.ticketPriceInteiraCents,
      ticketPriceMeiaCents: games.ticketPriceMeiaCents,
      meiaEligibilityLabel: games.meiaEligibilityLabel,
      active: games.active,
    })
    .from(games)
    .where(whereClause)
    .orderBy(desc(games.date))
    .limit(limit)
    .offset(offset);

  return { rows, total: Number(totalRow.total) };
}

export async function getAdminGameById(id: string): Promise<GameRow | null> {
  const db = await getDb();
  const rows = await db
    .select({
      id: games.id,
      season: games.season,
      competition: games.competition,
      round: games.round,
      date: games.date,
      isHome: games.isHome,
      opponent: games.opponent,
      opponentCrestUrl: games.opponentCrestUrl,
      venue: games.venue,
      ticketPriceInteiraCents: games.ticketPriceInteiraCents,
      ticketPriceMeiaCents: games.ticketPriceMeiaCents,
      meiaEligibilityLabel: games.meiaEligibilityLabel,
      active: games.active,
    })
    .from(games)
    .where(eq(games.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createGame(
  data: GameInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  const db = await getDb();
  try {
    const [game] = await db
      .insert(games)
      .values({
        season: data.season,
        competition: data.competition,
        round: data.round,
        date: data.date,
        isHome: data.isHome,
        opponent: data.opponent,
        opponentCrestUrl: data.opponentCrestUrl ?? null,
        venue: data.venue,
        ticketPriceInteiraCents: data.ticketPriceInteiraCents ?? null,
        ticketPriceMeiaCents: data.ticketPriceMeiaCents ?? null,
        meiaEligibilityLabel: data.meiaEligibilityLabel ?? null,
        active: data.active,
      })
      .returning({ id: games.id });

    await logAudit("create_game", "game", game.id, { opponent: data.opponent, competition: data.competition });
    revalidatePath("/admin/jogos");
    return { success: true, id: game.id };
  } catch (err) {
    console.error("createGame error:", err);
    return { success: false, error: "Erro ao criar jogo" };
  }
}

export async function updateGame(
  id: string,
  data: Partial<GameInput>
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  try {
    const updateData: Partial<typeof games.$inferInsert> = {};
    if (data.season !== undefined) updateData.season = data.season;
    if (data.competition !== undefined) updateData.competition = data.competition;
    if (data.round !== undefined) updateData.round = data.round;
    if (data.date !== undefined) updateData.date = data.date;
    if (data.isHome !== undefined) updateData.isHome = data.isHome;
    if (data.opponent !== undefined) updateData.opponent = data.opponent;
    if (data.opponentCrestUrl !== undefined)
      updateData.opponentCrestUrl = data.opponentCrestUrl;
    if (data.venue !== undefined) updateData.venue = data.venue;
    if (data.ticketPriceInteiraCents !== undefined)
      updateData.ticketPriceInteiraCents = data.ticketPriceInteiraCents;
    if (data.ticketPriceMeiaCents !== undefined)
      updateData.ticketPriceMeiaCents = data.ticketPriceMeiaCents;
    if (data.meiaEligibilityLabel !== undefined)
      updateData.meiaEligibilityLabel = data.meiaEligibilityLabel;
    if (data.active !== undefined) updateData.active = data.active;

    if (Object.keys(updateData).length === 0) return { success: false, error: "Nenhum campo para atualizar." };
    await db.update(games).set(updateData).where(eq(games.id, id));

    await logAudit("update_game", "game", id);
    revalidatePath("/admin/jogos");
    return { success: true };
  } catch (err) {
    console.error("updateGame error:", err);
    return { success: false, error: "Erro ao atualizar jogo" };
  }
}

export async function toggleGameActive(
  id: string,
  active: boolean
): Promise<void> {
  const db = await getDb();
  await db.update(games).set({ active }).where(eq(games.id, id));
  revalidatePath("/admin/jogos");
}

export async function deleteGame(id: string): Promise<{ success: boolean }> {
  const db = await getDb();
  await db.update(games).set({ active: false }).where(eq(games.id, id));
  await logAudit("delete_game", "game", id);
  revalidatePath("/admin/jogos");
  return { success: true };
}

export async function duplicateGame(
  id: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const db = await getDb();
  try {
    const [original] = await db.select().from(games).where(eq(games.id, id)).limit(1);
    if (!original) return { success: false, error: "Jogo não encontrado." };

    const [newGame] = await db
      .insert(games)
      .values({
        season: original.season,
        competition: original.competition,
        round: `${original.round} (Cópia)`,
        date: original.date,
        isHome: original.isHome,
        opponent: original.opponent,
        opponentCrestUrl: original.opponentCrestUrl,
        venue: original.venue,
        active: false,
      })
      .returning({ id: games.id });

    await logAudit("duplicate_game", "game", newGame.id, { sourceId: id });
    revalidatePath("/admin/jogos");
    return { success: true, id: newGame.id };
  } catch (err) {
    console.error("duplicateGame error:", err);
    return { success: false, error: "Erro ao duplicar jogo." };
  }
}

// ─── EXPORT CSV ─────────────────────────────────────────────────────────────

export async function exportOrdersCSV(status?: string): Promise<string> {
  const db = await getDb();
  const conditions = status && status !== "all"
    ? [eq(orders.status, status as "pending" | "paid" | "cancelled" | "refunded")]
    : [];

  const rows = await db
    .select({
      id: orders.id,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      customerWhatsapp: orders.customerWhatsapp,
      totalCents: orders.totalCents,
      status: orders.status,
      pickupInfo: orders.pickupInfo,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt));

  const orderIds = rows.map((r) => r.id);

  const [itemRows, paymentRows] = orderIds.length > 0
    ? await Promise.all([
        db.select({
          orderId: orderItems.orderId,
          type: orderItems.type,
          quantity: orderItems.quantity,
          unitPriceCents: orderItems.unitPriceCents,
          metadata: orderItems.metadata,
        }).from(orderItems).where(inArray(orderItems.orderId, orderIds)),
        db.select({
          orderId: payments.orderId,
          gatewaySlug: payments.gatewaySlug,
          status: payments.status,
          paidAt: payments.paidAt,
        }).from(payments).where(inArray(payments.orderId, orderIds)),
      ])
    : [[], []];

  const itemsByOrder = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  const paymentByOrder = new Map<string, (typeof paymentRows)[0]>();
  for (const p of paymentRows) {
    paymentByOrder.set(p.orderId, p);
  }

  function describeItem(item: { type: string; quantity: number; unitPriceCents: number; metadata: unknown }): string {
    const meta = item.metadata as Record<string, unknown> | null;
    if (meta?.isCouponDiscount) {
      return `Cupom ${meta.couponCode ?? ""}`;
    }
    let label: string;
    if (item.type === "ticket") {
      const ticketType = meta?.ticketType as string | undefined;
      label = ticketType === "meia" ? "Ingresso Meia-entrada" : "Ingresso Inteira";
    } else if (item.type === "product") {
      const parts = [
        meta?.name as string | undefined,
        meta?.color as string | undefined,
        meta?.size ? `Tam. ${meta.size}` : undefined,
      ].filter(Boolean);
      label = parts.join(" · ") || "Produto";
    } else {
      label = item.type;
    }
    const subtotal = (item.quantity * item.unitPriceCents / 100).toFixed(2).replace(".", ",");
    return `${item.quantity}x ${label} (R$ ${subtotal})`;
  }

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const fmtDate = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }) : "";

  const header = "ID,Nome,Email,WhatsApp,Valor (R$),Status,Método,Status Pagamento,Pago em,Retirada,Itens,Data";
  const lines = rows.map((r) => {
    const payment = paymentByOrder.get(r.id);
    const items = itemsByOrder.get(r.id) ?? [];
    const itemsDesc = items
      .filter((i) => !(i.metadata as Record<string, unknown> | null)?.isCouponDiscount)
      .map(describeItem)
      .join(" | ");

    return [
      escape(r.id.slice(0, 8).toUpperCase()),
      escape(r.customerName),
      escape(r.customerEmail),
      escape(r.customerWhatsapp),
      (r.totalCents / 100).toFixed(2).replace(".", ","),
      escape(r.status),
      escape(payment?.gatewaySlug?.toUpperCase() ?? "—"),
      escape(payment?.status ?? "—"),
      escape(fmtDate(payment?.paidAt ?? null)),
      escape(r.pickupInfo ?? ""),
      escape(itemsDesc),
      escape(fmtDate(r.createdAt)),
    ].join(",");
  });

  return [header, ...lines].join("\n");
}

// ─── SITE CONFIG ────────────────────────────────────────────────────────────

export async function getAdminConfigRows(): Promise<SiteConfigRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      key: siteConfig.key,
      value: siteConfig.value,
      type: siteConfig.type,
      description: siteConfig.description,
    })
    .from(siteConfig)
    .orderBy(asc(siteConfig.key));

  return rows;
}

// Tipo correto para cada chave — garante parse correto em getSiteConfig()
const CONFIG_KEY_TYPES: Record<string, "string" | "number" | "boolean" | "json"> = {
  whatsapp: "string",
  email: "string",
  instagram: "string",
  clubLogoUrl: "string",
  primaryColor: "string",
  accentColor: "string",
  ticketPriceInteiraCents: "number",
  ticketPriceMeiaCents: "number",
  meiaEligibilityLabel: "string",
  ticketBundleTiers: "json",
  ticketBundleTypeCodes: "json",
  raffleNumberPriceCents: "number",
  sessionDurationHours: "number",
  shopLowStockThreshold: "number",
  shippingEnabled: "boolean",
  shippingOriginCep: "string",
  shippingFreeAboveCents: "number",
};

export async function updateConfigValues(
  updates: Record<string, string>
): Promise<void> {
  const db = await getDb();
  const session = await getAdminSession();
  if (!session || session.role !== "admin") throw new Error("Não autorizado.");
  for (const [key, value] of Object.entries(updates)) {
    const type = CONFIG_KEY_TYPES[key] ?? "string";
    await db
      .insert(siteConfig)
      .values({ key, value, type, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: siteConfig.key,
        // Atualiza value e type (garante que linhas antigas com type errado sejam corrigidas)
        set: { value, type, updatedAt: new Date() },
      });
  }

  revalidatePath("/admin/configuracoes");
}

// ─── GATEWAYS ───────────────────────────────────────────────────────────────

export async function getAdminGateways(): Promise<
  { id: string; name: string; slug: string; active: boolean; paymentMethods: string[] }[]
> {
  const db = await getDb();
  const rows = await db
    .select({
      id: paymentGateways.id,
      name: paymentGateways.name,
      slug: paymentGateways.slug,
      active: paymentGateways.active,
      paymentMethods: paymentGateways.paymentMethods,
    })
    .from(paymentGateways)
    .orderBy(asc(paymentGateways.name));

  return rows;
}

export async function setActiveGateway(id: string): Promise<void> {
  const db = await getDb();
  const session = await getAdminSession();
  if (!session || session.role !== "admin") throw new Error("Não autorizado.");

  // Apenas alterna o estado do gateway indicado — múltiplos podem estar ativos
  const [row] = await db
    .select({ active: paymentGateways.active })
    .from(paymentGateways)
    .where(eq(paymentGateways.id, id))
    .limit(1);
  if (!row) return;

  await db
    .update(paymentGateways)
    .set({ active: !row.active })
    .where(eq(paymentGateways.id, id));

  revalidatePath("/admin/configuracoes");
  revalidateTag("payment_gateway", { expire: 0 });
}

// ─── CANCEL ORDER (unified: pending → cancelled, paid → refunded) ────────────

export async function cancelOrder(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  const [order] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return { success: false, error: "Pedido não encontrado." };
  if (order.status === "cancelled" || order.status === "refunded") {
    return { success: false, error: "Pedido já cancelado ou reembolsado." };
  }

  if (order.status === "paid") {
    return refundOrder(orderId);
  }

  // pending → cancelled
  await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, orderId));
  await db
    .update(payments)
    .set({ status: "failed" })
    .where(and(eq(payments.orderId, orderId), eq(payments.status, "pending")));

  const { cancelAffiliateReferral } = await import("@/app/actions/affiliates");
  await cancelAffiliateReferral(orderId);

  await logAudit("cancel_order", "order", orderId);
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${orderId}`);
  return { success: true };
}

// ─── SINCRONIZAÇÃO DB ↔ GATEWAY (agnóstica de gateway) ──────────────────────

/**
 * Resolvedor de gateways por `slug`, com cache por execução. Cada pagamento
 * guarda o `gatewaySlug` que o originou, então a sincronização funciona para
 * ASAAS, Mercado Pago e qualquer gateway futuro — basta que ele implemente
 * `getPaymentStatus` (já exigido pela interface `PaymentGateway`). Gateways
 * indisponíveis/desconfigurados resolvem para `null` (logado uma vez por slug).
 */
function createGatewayResolver(): (slug: string) => Promise<PaymentGateway | null> {
  const cache = new Map<string, Promise<PaymentGateway | null>>();
  return (slug: string) => {
    let entry = cache.get(slug);
    if (!entry) {
      entry = getPaymentGatewayBySlug(slug).catch((err) => {
        console.error(`[sync] gateway '${slug}' indisponível:`, err);
        return null;
      });
      cache.set(slug, entry);
    }
    return entry;
  };
}

// ─── CANCEL EXPIRED PENDING ORDERS (called by cron) ─────────────────────────

export async function cancelExpiredPendingOrders(): Promise<{ cancelled: number }> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);

  const expired = await db
    .select({
      orderId: orders.id,
      paymentId: payments.id,
      gatewaySlug: payments.gatewaySlug,
      gatewayPaymentId: payments.gatewayPaymentId,
    })
    .from(orders)
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .where(and(eq(orders.status, "pending"), lt(orders.createdAt, cutoff)));

  if (expired.length === 0) return { cancelled: 0 };

  // O gateway é a fonte da verdade: antes de marcar como falho, confirmamos que
  // o pagamento realmente não foi pago. Evita cancelar pedido já pago no gateway.
  const resolveGateway = createGatewayResolver();

  let cancelled = 0;
  await Promise.all(
    expired.map(async (row) => {
      if (row.gatewaySlug && row.gatewayPaymentId && row.paymentId) {
        const gateway = await resolveGateway(row.gatewaySlug);
        if (gateway) {
          try {
            const status = await gateway.getPaymentStatus(row.gatewayPaymentId);
            if (status !== "pending") {
              // Pago/estornado no gateway → sincroniza em vez de cancelar.
              await applyGatewayStatus(row.paymentId, row.orderId, status);
              if (status === "paid" || status === "refunded") return;
            }
          } catch (err) {
            // Gateway indisponível para este pagamento → não cancela por segurança.
            console.error(`[expire] erro ao consultar ${row.gatewayPaymentId}:`, err);
            return;
          }
        }
      }

      await Promise.all([
        db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, row.orderId)),
        db
          .update(payments)
          .set({ status: "failed" })
          .where(and(eq(payments.orderId, row.orderId), eq(payments.status, "pending"))),
      ]);
      cancelled++;
    })
  );

  return { cancelled };
}

// ─── RECONCILIAÇÃO COM O GATEWAY (disparada no load do dashboard) ────────────

/** Só sincroniza se passou esse tempo desde a última reconciliação. */
const RECONCILE_MIN_INTERVAL_MINUTES = 10;
/** Reconcilia apenas vendas recentes (janela em horas). */
const RECONCILE_WINDOW_HOURS = 48;
/** Limite de segurança de pagamentos por execução. */
const RECONCILE_MAX_PER_RUN = 250;
const RECONCILE_CONFIG_KEY = "last_payment_reconcile_at";

/**
 * Rede de segurança contra dessincronização DB ↔ gateway: varre pagamentos
 * recentes ainda `pending`/`failed` e alinha o status ao que o gateway reporta
 * (fonte da verdade). Cobre webhooks perdidos e race conditions. É barato pois
 * só roda de fato a cada `RECONCILE_MIN_INTERVAL_MINUTES` (gate global via
 * `siteConfig`), independente de quantos admins abram o dashboard.
 *
 * Agnóstica de gateway: cada pagamento é reconciliado pelo gateway que o
 * originou (`gatewaySlug`), então ASAAS, Mercado Pago e gateways futuros são
 * cobertos sem alteração aqui.
 */
export async function reconcileRecentPayments(): Promise<{
  synced: boolean;
  checked: number;
  corrected: number;
}> {
  const db = await getDb();
  const [cfg] = await db
    .select({ value: siteConfig.value })
    .from(siteConfig)
    .where(eq(siteConfig.key, RECONCILE_CONFIG_KEY))
    .limit(1);

  const now = Date.now();
  if (cfg?.value) {
    const last = new Date(cfg.value).getTime();
    if (Number.isFinite(last) && now - last < RECONCILE_MIN_INTERVAL_MINUTES * 60 * 1000) {
      return { synced: false, checked: 0, corrected: 0 };
    }
  }

  // Grava o timestamp ANTES do trabalho para evitar disparos concorrentes.
  const nowIso = new Date(now).toISOString();
  await db
    .insert(siteConfig)
    .values({ key: RECONCILE_CONFIG_KEY, value: nowIso, type: "string" })
    .onConflictDoUpdate({ target: siteConfig.key, set: { value: nowIso } });

  const windowStart = new Date(now - RECONCILE_WINDOW_HOURS * 60 * 60 * 1000);

  const candidates = await db
    .select({
      id: payments.id,
      orderId: payments.orderId,
      status: payments.status,
      gatewaySlug: payments.gatewaySlug,
      gatewayPaymentId: payments.gatewayPaymentId,
    })
    .from(payments)
    .where(
      and(
        inArray(payments.status, ["pending", "failed"]),
        gte(payments.createdAt, windowStart),
        isNotNull(payments.gatewayPaymentId)
      )
    )
    .orderBy(desc(payments.createdAt))
    .limit(RECONCILE_MAX_PER_RUN + 1);

  if (candidates.length > RECONCILE_MAX_PER_RUN) {
    console.warn(
      `[reconcile] >${RECONCILE_MAX_PER_RUN} pagamentos na janela; verificando apenas os ${RECONCILE_MAX_PER_RUN} mais recentes`
    );
    candidates.length = RECONCILE_MAX_PER_RUN;
  }

  if (candidates.length === 0) return { synced: true, checked: 0, corrected: 0 };

  // Cada pagamento é consultado no gateway que o originou (cache por execução).
  const resolveGateway = createGatewayResolver();

  let corrected = 0;
  await Promise.all(
    candidates.map(async (p) => {
      if (!p.gatewayPaymentId) return;
      const gateway = await resolveGateway(p.gatewaySlug);
      if (!gateway) return;
      try {
        const status = await gateway.getPaymentStatus(p.gatewayPaymentId);
        if (status !== "pending" && status !== p.status) {
          const changed = await applyGatewayStatus(p.id, p.orderId, status);
          if (changed) corrected++;
        }
      } catch (err) {
        console.error(`[reconcile] erro no pagamento ${p.gatewayPaymentId}:`, err);
      }
    })
  );

  if (corrected > 0) {
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/pedidos");
  }

  return { synced: true, checked: candidates.length, corrected };
}

export async function cancelExpiredAndGetOldestPending(): Promise<{
  cancelled: number;
  oldestPendingCreatedAt: string | null;
}> {
  const db = await getDb();
  const { cancelled } = await cancelExpiredPendingOrders();

  const [oldest] = await db
    .select({ createdAt: orders.createdAt })
    .from(orders)
    .where(eq(orders.status, "pending"))
    .orderBy(asc(orders.createdAt))
    .limit(1);

  return {
    cancelled,
    oldestPendingCreatedAt: oldest?.createdAt?.toISOString() ?? null,
  };
}

// ─── REFUND ─────────────────────────────────────────────────────────────────

export async function refundOrder(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  try {
    const [paymentRow] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, orderId), eq(payments.status, "paid")))
      .limit(1);

    if (!paymentRow) {
      return { success: false, error: "Pagamento pago não encontrado para este pedido." };
    }

    if (!paymentRow.gatewayPaymentId) {
      return { success: false, error: "ID do pagamento no gateway não encontrado." };
    }

    const { getPaymentGatewayBySlug } = await import("@/lib/payment");
    const gateway = await getPaymentGatewayBySlug(paymentRow.gatewaySlug);

    if (!gateway.refundPayment) {
      return {
        success: false,
        error: `O gateway ${paymentRow.gatewaySlug} não suporta reembolso automático. Faça o reembolso manualmente no painel do gateway.`,
      };
    }

    await gateway.refundPayment(paymentRow.gatewayPaymentId);

    await db
      .update(payments)
      .set({ status: "refunded" })
      .where(eq(payments.id, paymentRow.id));

    await db
      .update(orders)
      .set({ status: "refunded" })
      .where(eq(orders.id, orderId));

    const { cancelAffiliateReferral } = await import("@/app/actions/affiliates");
    await cancelAffiliateReferral(orderId);

    await logAudit("refund_order", "order", orderId);
    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${orderId}`);

    return { success: true };
  } catch (err) {
    console.error("refundOrder error:", err);
    const raw = err instanceof Error ? err.message : "";
    // Extract a readable reason without exposing internal gateway URLs
    const friendly = raw.includes("404")
      ? "Pagamento não encontrado no gateway. Verifique se ele ainda existe e faça o reembolso manualmente."
      : raw.includes("403") || raw.includes("401")
      ? "Sem permissão para reembolsar via API. Faça o reembolso manualmente no painel do gateway."
      : raw.includes("invalid_action") || raw.includes("invalid_object")
      ? "Gateway recusou o reembolso. Faça-o manualmente no painel."
      : "Erro ao processar reembolso. Verifique o painel do gateway e tente manualmente se necessário.";
    return { success: false, error: friendly };
  }
}

// ─── GATEWAY CRUD ────────────────────────────────────────────────────────────

export interface GatewayWithCredentials {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  paymentMethods: string[];
  credentials: Record<string, string>;
}

export interface GatewayInput {
  name: string;
  slug: string;
  active: boolean;
  paymentMethods: string[];
  credentials: Record<string, string>;
}

function maskCredentialValue(value: string): string {
  if (!value || value.length <= 6) return "****";
  return "****" + value.slice(-6);
}

export async function getAdminGatewayById(
  id: string
): Promise<GatewayWithCredentials | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(paymentGateways)
    .where(eq(paymentGateways.id, id))
    .limit(1);

  if (!row) return null;

  let rawCreds: Record<string, string> = {};
  try {
    rawCreds = JSON.parse(decrypt(row.credentials));
  } catch {
    // If credentials are empty/mock, return empty object
  }

  const maskedCreds: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawCreds)) {
    maskedCreds[k] = maskCredentialValue(v);
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    active: row.active,
    paymentMethods: row.paymentMethods ?? ["pix", "credit_card"],
    credentials: maskedCreds,
  };
}

export async function createGateway(
  data: GatewayInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  const db = await getDb();
  try {
    const encryptedCreds = encrypt(JSON.stringify(data.credentials));

    const [gateway] = await db
      .insert(paymentGateways)
      .values({
        name: data.name,
        slug: data.slug,
        credentials: encryptedCreds,
        active: data.active,
        paymentMethods: data.paymentMethods ?? ["pix", "credit_card"],
      })
      .returning({ id: paymentGateways.id });

    await logAudit("create_gateway", "gateway", gateway.id, { name: data.name, slug: data.slug });
    revalidatePath("/admin/configuracoes");
    revalidateTag("payment_gateway", { expire: 0 });
    return { success: true, id: gateway.id };
  } catch (err) {
    console.error("createGateway error:", err);
    return { success: false, error: "Erro ao criar gateway." };
  }
}

export async function updateGateway(
  id: string,
  data: Partial<GatewayInput> & { credentialsChanged?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  try {
    const updateData: Partial<typeof paymentGateways.$inferInsert> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.paymentMethods !== undefined) updateData.paymentMethods = data.paymentMethods;

    if (data.credentialsChanged && data.credentials !== undefined) {
      updateData.credentials = encrypt(JSON.stringify(data.credentials));
    }

    if (Object.keys(updateData).length > 0) {
      await db
        .update(paymentGateways)
        .set(updateData)
        .where(eq(paymentGateways.id, id));
    }

    await logAudit("update_gateway", "gateway", id);
    revalidatePath("/admin/configuracoes");
    revalidateTag("payment_gateway", { expire: 0 });
    return { success: true };
  } catch (err) {
    console.error("updateGateway error:", err);
    return { success: false, error: "Erro ao atualizar gateway." };
  }
}

export async function deleteGateway(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  try {
    const [row] = await db
      .select({ active: paymentGateways.active })
      .from(paymentGateways)
      .where(eq(paymentGateways.id, id))
      .limit(1);

    if (!row) return { success: false, error: "Gateway não encontrado." };

    await db.delete(paymentGateways).where(eq(paymentGateways.id, id));

    await logAudit("delete_gateway", "gateway", id);
    revalidatePath("/admin/configuracoes");
    return { success: true };
  } catch (err) {
    console.error("deleteGateway error:", err);
    return { success: false, error: "Erro ao remover gateway." };
  }
}

// ─── BULK ACTIONS ────────────────────────────────────────────────────────────

export async function bulkCancelOrders(
  ids: string[]
): Promise<{ cancelled: number; errors: number }> {
  const db = await getDb();
  if (ids.length === 0) return { cancelled: 0, errors: 0 };

  const rows = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(inArray(orders.id, ids));

  const cancellable = rows.filter(
    (r) => r.status === "pending"
  );

  if (cancellable.length === 0) return { cancelled: 0, errors: rows.length - cancellable.length };

  const cancellableIds = cancellable.map((r) => r.id);

  await db
    .update(orders)
    .set({ status: "cancelled" })
    .where(inArray(orders.id, cancellableIds));

  await db
    .update(payments)
    .set({ status: "failed" })
    .where(and(inArray(payments.orderId, cancellableIds), eq(payments.status, "pending")));

  await logAudit("bulk_cancel_orders", "order", null, { ids: cancellableIds, count: cancellableIds.length });

  revalidatePath("/admin/pedidos");
  return { cancelled: cancellableIds.length, errors: rows.length - cancellableIds.length };
}

// ─── EMAIL RESEND ────────────────────────────────────────────────────────────

export interface PaidOrderEmailRow {
  id: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  totalCents: number;
  createdAt: Date;
  hasProducts: boolean;
  hasTickets: boolean;
}

export async function getPaidOrdersForEmail(params: {
  page: number;
  search?: string;
  limit?: number;
}): Promise<{ rows: PaidOrderEmailRow[]; total: number }> {
  const db = await getDb();
  const session = await getAdminSession();
  if (!session || session.role !== "admin") return { rows: [], total: 0 };

  const { page, search, limit = 30 } = params;
  const offset = (page - 1) * limit;

  const conditions = [eq(orders.status, "paid")];
  if (search?.trim()) {
    const pattern = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(orders.customerName, pattern),
        ilike(orders.customerEmail, pattern),
        ilike(orders.customerWhatsapp, pattern)
      )!
    );
  }
  const whereClause = and(...conditions);

  const [totalRow] = await db.select({ total: count() }).from(orders).where(whereClause);

  const rows = await db
    .select({
      id: orders.id,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      customerWhatsapp: orders.customerWhatsapp,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(whereClause)
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);

  if (rows.length === 0) return { rows: [], total: Number(totalRow.total) };

  const orderIds = rows.map((r) => r.id);
  const itemTypes = await db
    .select({ orderId: orderItems.orderId, type: orderItems.type })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds));

  const typeMap = new Map<string, { hasProducts: boolean; hasTickets: boolean }>();
  for (const item of itemTypes) {
    const entry = typeMap.get(item.orderId) ?? { hasProducts: false, hasTickets: false };
    if (item.type === "product") entry.hasProducts = true;
    if (item.type === "ticket") entry.hasTickets = true;
    typeMap.set(item.orderId, entry);
  }

  return {
    rows: rows.map((r) => ({
      ...r,
      hasProducts: typeMap.get(r.id)?.hasProducts ?? false,
      hasTickets: typeMap.get(r.id)?.hasTickets ?? false,
    })),
    total: Number(totalRow.total),
  };
}

export async function resendOrderEmail(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  const session = await getAdminSession();
  if (!session || session.role !== "admin") return { success: false, error: "Não autorizado." };

  const [order] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return { success: false, error: "Pedido não encontrado." };
  if (order.status !== "paid") return { success: false, error: "Pedido não está pago." };

  try {
    const { sendOrderConfirmation } = await import("@/lib/email");
    await sendOrderConfirmation(orderId);
    await logAudit("resend_email", "order", orderId);
    return { success: true };
  } catch (err) {
    console.error("resendOrderEmail error:", err);
    return { success: false, error: "Falha ao enviar e-mail." };
  }
}
