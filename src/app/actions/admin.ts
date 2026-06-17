"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
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
} from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/payment/encryption";
import { getPaymentGateway } from "@/lib/payment";
import { logAudit } from "@/lib/audit";
import { startOfDayBrasilia } from "@/lib/date";
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

export async function getAdminStats(): Promise<AdminStats> {
  const now = new Date();
  const startOfToday = startOfDayBrasilia(0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Revenue today (paid orders only)
  const [revTodayRow] = await db
    .select({ total: sql<number>`coalesce(sum(${orders.totalCents}), 0)` })
    .from(orders)
    .where(and(eq(orders.status, "paid"), gte(orders.createdAt, startOfToday)));

  // Revenue this month
  const [revMonthRow] = await db
    .select({ total: sql<number>`coalesce(sum(${orders.totalCents}), 0)` })
    .from(orders)
    .where(
      and(eq(orders.status, "paid"), gte(orders.createdAt, startOfMonth))
    );

  // Orders today (all statuses)
  const [ordersTodayRow] = await db
    .select({ total: count() })
    .from(orders)
    .where(gte(orders.createdAt, startOfToday));

  // Orders by status (all time)
  const statusCounts = await db
    .select({ status: orders.status, total: count() })
    .from(orders)
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
    .where(and(eq(orders.status, "paid"), gte(orders.createdAt, sevenDaysAgo)))
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

export async function getRecentOrders(
  limit = 10
): Promise<RecentOrderRow[]> {
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
}): Promise<{ rows: OrderRow[]; total: number }> {
  const { page, status, search, limit = 20 } = params;
  const offset = (page - 1) * limit;

  const conditions = [];

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

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, id))
    .limit(1);

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
    createdAt: order.createdAt,
    items: items.map((item) => ({
      id: item.id,
      type: item.type,
      referenceId: item.referenceId ?? null,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      metadata: item.metadata,
    })),
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
  active: boolean;
}

export async function getAdminGames(params: {
  season?: number;
  search?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{ rows: GameRow[]; total: number }> {
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
  await db.update(games).set({ active }).where(eq(games.id, id));
  revalidatePath("/admin/jogos");
}

export async function deleteGame(id: string): Promise<{ success: boolean }> {
  await db.update(games).set({ active: false }).where(eq(games.id, id));
  await logAudit("delete_game", "game", id);
  revalidatePath("/admin/jogos");
  return { success: true };
}

export async function duplicateGame(
  id: string
): Promise<{ success: boolean; id?: string; error?: string }> {
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
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt));

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const header = "ID,Nome,Email,WhatsApp,Valor (R$),Status,Data";
  const lines = rows.map((r) =>
    [
      escape(r.id.slice(0, 8).toUpperCase()),
      escape(r.customerName),
      escape(r.customerEmail),
      escape(r.customerWhatsapp),
      (r.totalCents / 100).toFixed(2).replace(".", ","),
      escape(r.status),
      escape(new Date(r.createdAt).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      })),
    ].join(",")
  );

  return [header, ...lines].join("\n");
}

// ─── SITE CONFIG ────────────────────────────────────────────────────────────

export async function getAdminConfigRows(): Promise<SiteConfigRow[]> {
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

export async function updateConfigValues(
  updates: Record<string, string>
): Promise<void> {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") throw new Error("Não autorizado.");
  for (const [key, value] of Object.entries(updates)) {
    await db
      .insert(siteConfig)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: siteConfig.key,
        set: { value, updatedAt: new Date() },
      });
  }

  revalidatePath("/admin/configuracoes");
}

// ─── GATEWAYS ───────────────────────────────────────────────────────────────

export async function getAdminGateways(): Promise<
  { id: string; name: string; slug: string; active: boolean }[]
> {
  const rows = await db
    .select({
      id: paymentGateways.id,
      name: paymentGateways.name,
      slug: paymentGateways.slug,
      active: paymentGateways.active,
    })
    .from(paymentGateways)
    .orderBy(asc(paymentGateways.name));

  return rows;
}

export async function setActiveGateway(id: string): Promise<void> {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") throw new Error("Não autorizado.");
  await db.update(paymentGateways).set({ active: false });
  await db
    .update(paymentGateways)
    .set({ active: true })
    .where(eq(paymentGateways.id, id));

  revalidatePath("/admin/configuracoes");
}

// ─── CANCEL ORDER (unified: pending → cancelled, paid → refunded) ────────────

export async function cancelOrder(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
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

// ─── CANCEL EXPIRED PENDING ORDERS (called by cron) ─────────────────────────

export async function cancelExpiredPendingOrders(): Promise<{ cancelled: number }> {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);

  const expired = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "pending"), lt(orders.createdAt, cutoff)));

  if (expired.length === 0) return { cancelled: 0 };

  await Promise.all(
    expired.map(({ id }) =>
      Promise.all([
        db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, id)),
        db
          .update(payments)
          .set({ status: "failed" })
          .where(and(eq(payments.orderId, id), eq(payments.status, "pending"))),
      ])
    )
  );

  return { cancelled: expired.length };
}

export async function cancelExpiredAndGetOldestPending(): Promise<{
  cancelled: number;
  oldestPendingCreatedAt: string | null;
}> {
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
  credentials: Record<string, string>;
}

export interface GatewayInput {
  name: string;
  slug: string;
  active: boolean;
  credentials: Record<string, string>;
}

function maskCredentialValue(value: string): string {
  if (!value || value.length <= 6) return "****";
  return "****" + value.slice(-6);
}

export async function getAdminGatewayById(
  id: string
): Promise<GatewayWithCredentials | null> {
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
    credentials: maskedCreds,
  };
}

export async function createGateway(
  data: GatewayInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const encryptedCreds = encrypt(JSON.stringify(data.credentials));

    const [gateway] = await db
      .insert(paymentGateways)
      .values({
        name: data.name,
        slug: data.slug,
        credentials: encryptedCreds,
        active: data.active,
      })
      .returning({ id: paymentGateways.id });

    if (data.active) {
      // Deactivate all other gateways, then activate this one exclusively
      await db
        .update(paymentGateways)
        .set({ active: false })
        .where(ne(paymentGateways.id, gateway.id));
    }

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
  try {
    const updateData: Partial<typeof paymentGateways.$inferInsert> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.active !== undefined) updateData.active = data.active;

    if (data.credentialsChanged && data.credentials !== undefined) {
      updateData.credentials = encrypt(JSON.stringify(data.credentials));
    }

    if (Object.keys(updateData).length > 0) {
      await db
        .update(paymentGateways)
        .set(updateData)
        .where(eq(paymentGateways.id, id));
    }

    if (data.active) {
      // Deactivate all other gateways to enforce single active gateway
      await db
        .update(paymentGateways)
        .set({ active: false })
        .where(ne(paymentGateways.id, id));
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
  try {
    const [row] = await db
      .select({ active: paymentGateways.active })
      .from(paymentGateways)
      .where(eq(paymentGateways.id, id))
      .limit(1);

    if (!row) return { success: false, error: "Gateway não encontrado." };
    if (row.active) {
      return {
        success: false,
        error: "Não é possível remover o gateway ativo. Ative outro gateway antes.",
      };
    }

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
