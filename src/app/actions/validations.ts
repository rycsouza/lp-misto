"use server";

import { db } from "@/lib/db/client";
import { ticketValidations, orders, orderItems, games, tickets } from "@/lib/db/schema";
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

function fmtDateTime(d: Date): string {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export type ValidateResult =
  | { ok: true; ticketQuantity: number; customerName: string; typeName?: string }
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

  const id = rawScan.trim().toLowerCase();
  if (!isValidUUID(id)) {
    return { ok: false, reason: "invalid_qr", message: "QR Code inválido." };
  }

  // ── Modelo novo: 1 QR por ingresso individual ──────────────────────────────
  try {
    const [tk] = await db
      .select({
        id: tickets.id,
        gameId: tickets.gameId,
        status: tickets.status,
        typeName: tickets.typeName,
        validatedAt: tickets.validatedAt,
        validatedBy: tickets.validatedBy,
        orderStatus: orders.status,
        customerName: orders.customerName,
      })
      .from(tickets)
      .innerJoin(orders, eq(orders.id, tickets.orderId))
      .where(eq(tickets.id, id))
      .limit(1);

    if (tk) {
      if (tk.gameId !== gameId) {
        return { ok: false, reason: "wrong_game", message: "Ingresso é de outro jogo." };
      }
      if (tk.orderStatus !== "paid") {
        return { ok: false, reason: "not_paid", message: "Pedido não está pago." };
      }
      if (tk.status === "cancelled") {
        return { ok: false, reason: "not_paid", message: "Ingresso cancelado." };
      }
      if (tk.status === "validated") {
        const when = tk.validatedAt ? ` em ${fmtDateTime(tk.validatedAt as Date)}` : "";
        const by = tk.validatedBy ? ` por ${tk.validatedBy}` : "";
        return {
          ok: false,
          reason: "already_validated",
          message: `Ingresso já validado${by}${when}.`,
        };
      }

      // Marca como validado (guarda contra corrida via WHERE status='valid')
      const updated = await db
        .update(tickets)
        .set({ status: "validated", validatedAt: new Date(), validatedBy: session.name })
        .where(and(eq(tickets.id, id), eq(tickets.status, "valid")))
        .returning({ id: tickets.id });

      if (updated.length === 0) {
        return { ok: false, reason: "already_validated", message: "Ingresso já validado." };
      }
      return {
        ok: true,
        ticketQuantity: 1,
        customerName: tk.customerName,
        typeName: tk.typeName,
      };
    }
  } catch {
    // tabela tickets ainda não migrada → cai no modelo legado abaixo
  }

  // ── Modelo legado: QR = id do pedido (valida o pedido inteiro no jogo) ──────
  return validateLegacyOrder(id, gameId, session.name);
}

async function validateLegacyOrder(
  orderId: string,
  gameId: string,
  validatedBy: string
): Promise<ValidateResult> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return { ok: false, reason: "not_found", message: "Ingresso não encontrado." };
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
    await db.insert(ticketValidations).values({ orderId, gameId, ticketQuantity: qty, validatedBy });
    return { ok: true, ticketQuantity: qty, customerName: order.customerName };
  } catch (err) {
    if (isUniqueError(err)) {
      return { ok: false, reason: "already_validated", message: "Ingresso já utilizado." };
    }
    console.error("validateTicket(legacy) error:", err);
    return { ok: false, reason: "error", message: "Erro interno." };
  }
}

export async function getGameValidationStats(gameId: string) {
  let ticketsValidated = 0;
  let ticketOrders = 0;
  try {
    const [t] = await db
      .select({
        tickets: sql<number>`count(*)::int`,
        orders: sql<number>`count(distinct ${tickets.orderId})::int`,
      })
      .from(tickets)
      .where(and(eq(tickets.gameId, gameId), eq(tickets.status, "validated")));
    ticketsValidated = Number(t?.tickets ?? 0);
    ticketOrders = Number(t?.orders ?? 0);
  } catch {
    /* tabela não migrada */
  }

  // Validações legadas (pedidos validados antes do modelo por ingresso)
  const [legacy] = await db
    .select({
      orders: sql<number>`count(*)::int`,
      tickets: sql<number>`coalesce(sum(${ticketValidations.ticketQuantity}), 0)::int`,
    })
    .from(ticketValidations)
    .where(eq(ticketValidations.gameId, gameId));

  return {
    totalOrders: ticketOrders + Number(legacy?.orders ?? 0),
    totalTickets: ticketsValidated + Number(legacy?.tickets ?? 0),
  };
}

export async function getRecentValidations(gameId: string, limit = 12) {
  const out: {
    id: string;
    orderId: string;
    ticketQuantity: number;
    validatedBy: string;
    validatedAt: string;
    customerName: string;
  }[] = [];

  try {
    const rows = await db
      .select({
        id: tickets.id,
        orderId: tickets.orderId,
        typeName: tickets.typeName,
        validatedBy: tickets.validatedBy,
        validatedAt: tickets.validatedAt,
        customerName: orders.customerName,
      })
      .from(tickets)
      .innerJoin(orders, eq(orders.id, tickets.orderId))
      .where(and(eq(tickets.gameId, gameId), eq(tickets.status, "validated")))
      .orderBy(desc(tickets.validatedAt))
      .limit(limit);
    for (const r of rows) {
      out.push({
        id: r.id,
        orderId: r.orderId,
        ticketQuantity: 1,
        validatedBy: r.validatedBy ?? "—",
        validatedAt: (r.validatedAt as Date).toISOString(),
        customerName: `${r.customerName ?? "—"} · ${r.typeName}`,
      });
    }
  } catch {
    /* tabela não migrada */
  }

  if (out.length < limit) {
    const legacy = await db
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
    for (const r of legacy) {
      out.push({
        id: r.id,
        orderId: r.orderId,
        ticketQuantity: r.ticketQuantity,
        validatedBy: r.validatedBy ?? "—",
        validatedAt: (r.validatedAt as Date).toISOString(),
        customerName: r.customerName ?? "—",
      });
    }
  }

  return out
    .sort((a, b) => (a.validatedAt < b.validatedAt ? 1 : -1))
    .slice(0, limit);
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
