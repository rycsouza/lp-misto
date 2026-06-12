"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import {
  orders,
  orderItems,
  payments,
  games,
  siteConfig,
  paymentGateways,
} from "@/lib/db/schema";
import {
  eq,
  desc,
  asc,
  ilike,
  and,
  or,
  sql,
  count,
  gte,
  lt,
} from "drizzle-orm";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AdminStats {
  totalRevenueTodayCents: number;
  totalRevenueMonthCents: number;
  ordersToday: number;
  ordersPending: number;
  ordersPaid: number;
  ordersCancelled: number;
  revenueChartData: { date: string; cents: number }[];
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

// ─── DASHBOARD STATS ────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<AdminStats> {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

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

  // Chart data: last 7 days
  const chartData: { date: string; cents: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [dayRow] = await db
      .select({ total: sql<number>`coalesce(sum(${orders.totalCents}), 0)` })
      .from(orders)
      .where(
        and(
          eq(orders.status, "paid"),
          gte(orders.createdAt, dayStart),
          lt(orders.createdAt, dayEnd)
        )
      );

    chartData.push({
      date: dayStart.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      cents: Number(dayRow.total),
    });
  }

  return {
    totalRevenueTodayCents: Number(revTodayRow.total),
    totalRevenueMonthCents: Number(revMonthRow.total),
    ordersToday: Number(ordersTodayRow.total),
    ordersPending: Number(pendingCount),
    ordersPaid: Number(paidCount),
    ordersCancelled: Number(cancelledCount),
    revenueChartData: chartData,
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
  await db.update(orders).set({ status }).where(eq(orders.id, orderId));

  if (status === "paid") {
    await db
      .update(payments)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(payments.orderId, orderId));
  }

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${orderId}`);
}

// ─── GAMES ──────────────────────────────────────────────────────────────────

export async function getAdminGames(): Promise<(typeof games.$inferSelect)[]> {
  return db.select().from(games).orderBy(desc(games.date));
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

    await db.update(games).set(updateData).where(eq(games.id, id));

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
  // Soft delete
  await db.update(games).set({ active: false }).where(eq(games.id, id));
  revalidatePath("/admin/jogos");
  return { success: true };
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
  await db.update(paymentGateways).set({ active: false });
  await db
    .update(paymentGateways)
    .set({ active: true })
    .where(eq(paymentGateways.id, id));

  revalidatePath("/admin/configuracoes");
}
