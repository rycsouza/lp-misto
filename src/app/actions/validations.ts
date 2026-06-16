"use server";

import { db } from "@/lib/db/client";
import { ticketValidations, orders, orderItems, games } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getAdminSession } from "@/app/actions/admin-auth";

function isUniqueError(err: unknown): boolean {
  const e = err as Record<string, unknown>;
  const code =
    (e?.code as string) ??
    ((e?.cause as Record<string, unknown>)?.code as string) ??
    ((e?.data as Record<string, unknown>)?.code as string);
  return code === "23505";
}

function isValidUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

export type ValidateResult =
  | { ok: true; ticketQuantity: number; customerName: string }
  | {
      ok: false;
      reason:
        | "invalid_qr"
        | "not_found"
        | "not_paid"
        | "no_tickets"
        | "wrong_game"
        | "already_validated"
        | "error";
      message: string;
    };

export async function validateTicket(
  rawScan: string,
  gameId: string
): Promise<ValidateResult> {
  const session = await getAdminSession();
  if (!session) return { ok: false, reason: "error", message: "Não autenticado." };

  const orderId = rawScan.trim().toLowerCase();
  if (!isValidUUID(orderId)) {
    return { ok: false, reason: "invalid_qr", message: "QR Code inválido." };
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return { ok: false, reason: "not_found", message: "Pedido não encontrado." };
  if (order.status !== "paid") {
    const labels: Record<string, string> = {
      pending: "aguardando pagamento",
      cancelled: "cancelado",
      refunded: "reembolsado",
    };
    return {
      ok: false,
      reason: "not_paid",
      message: `Pedido ${labels[order.status] ?? "inválido"}.`,
    };
  }

  // Ticket items for this specific game
  const forThisGame = await db
    .select()
    .from(orderItems)
    .where(
      and(
        eq(orderItems.orderId, orderId),
        eq(orderItems.type, "ticket"),
        eq(orderItems.referenceId, gameId)
      )
    );

  const realTickets = forThisGame.filter(
    (i) => !(i.metadata as Record<string, unknown>)?.isCouponDiscount
  );

  if (realTickets.length === 0) {
    // Check whether the order has tickets for a different game
    const otherTickets = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.orderId, orderId), eq(orderItems.type, "ticket")))
      .limit(1);

    if (otherTickets.length > 0) {
      return { ok: false, reason: "wrong_game", message: "Ingresso é de outro jogo." };
    }
    return { ok: false, reason: "no_tickets", message: "Pedido sem ingressos." };
  }

  const qty = realTickets.reduce((s, i) => s + i.quantity, 0);

  try {
    await db.insert(ticketValidations).values({
      orderId,
      gameId,
      ticketQuantity: qty,
      validatedBy: session.name,
    });

    return { ok: true, ticketQuantity: qty, customerName: order.customerName };
  } catch (err) {
    if (isUniqueError(err)) {
      return { ok: false, reason: "already_validated", message: "Ingresso já utilizado." };
    }
    console.error("validateTicket error:", err);
    return { ok: false, reason: "error", message: "Erro interno." };
  }
}

export async function getGameValidationStats(gameId: string) {
  const [row] = await db
    .select({
      totalOrders: sql<number>`count(*)::int`,
      totalTickets: sql<number>`coalesce(sum(${ticketValidations.ticketQuantity}), 0)::int`,
    })
    .from(ticketValidations)
    .where(eq(ticketValidations.gameId, gameId));

  return {
    totalOrders: Number(row?.totalOrders ?? 0),
    totalTickets: Number(row?.totalTickets ?? 0),
  };
}

export async function getRecentValidations(gameId: string, limit = 12) {
  const rows = await db
    .select({
      id: ticketValidations.id,
      orderId: ticketValidations.orderId,
      ticketQuantity: ticketValidations.ticketQuantity,
      validatedBy: ticketValidations.validatedBy,
      validatedAt: ticketValidations.validatedAt,
      customerName: orders.customerName,
    })
    .from(ticketValidations)
    .leftJoin(orders, eq(orders.id, ticketValidations.orderId))
    .where(eq(ticketValidations.gameId, gameId))
    .orderBy(desc(ticketValidations.validatedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    ticketQuantity: r.ticketQuantity,
    validatedBy: r.validatedBy ?? "—",
    validatedAt: (r.validatedAt as Date).toISOString(),
    customerName: r.customerName ?? "—",
  }));
}

export async function getHomeGamesForValidation() {
  const rows = await db
    .select()
    .from(games)
    .where(eq(games.isHome, true))
    .orderBy(desc(games.date))
    .limit(30);

  return rows.map((g) => ({
    id: g.id,
    opponent: g.opponent,
    competition: g.competition,
    round: g.round,
    date: (g.date as Date).toISOString(),
    venue: g.venue,
    active: g.active,
  }));
}
