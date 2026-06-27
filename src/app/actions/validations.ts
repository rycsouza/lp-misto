"use server";

import { getDb } from "@/lib/db/client";
import { ticketValidations, orders, orderItems, games, tickets } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getAdminSession } from "@/app/actions/admin-auth";
import { isSignedToken, verifyTicketToken } from "@/lib/tickets/token";

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
        | "wrong_type"
        | "already_validated"
        | "error";
      message: string;
    };

export async function validateTicket(
  rawScan: string,
  gameId: string,
  selectedTypeCode?: string
): Promise<ValidateResult> {
  const session = await getAdminSession();
  if (!session) return { ok: false, reason: "error", message: "Não autenticado." };

  const raw = rawScan.trim();

  const effectiveType = selectedTypeCode && selectedTypeCode !== "all" ? selectedTypeCode : undefined;

  // ── Caminho JWT: token assinado (formato novo, anti-fraude) ───────────────
  if (isSignedToken(raw)) {
    const verified = await verifyTicketToken(raw);
    if (!verified) {
      return { ok: false, reason: "invalid_qr", message: "QR Code inválido ou adulterado." };
    }
    // Pré-valida o jogo diretamente do payload (sem consultar o banco)
    if (verified.gid !== gameId) {
      return { ok: false, reason: "wrong_game", message: "Ingresso é de outro jogo." };
    }
    return validateByTicketId(verified.tid, gameId, session.name, effectiveType);
  }

  // ── Caminho UUID: formato legado (ingressos antes da assinatura JWT) ──────
  const id = raw.toLowerCase();
  if (!isValidUUID(id)) {
    return { ok: false, reason: "invalid_qr", message: "QR Code inválido." };
  }

  // Tenta modelo novo (tabela tickets) → depois legado (pedido inteiro)
  try {
    const result = await validateByTicketId(id, gameId, session.name, effectiveType);
    // Se não encontrado na tabela tickets, cai para o legado
    if (result.ok || result.reason !== "not_found") return result;
  } catch {
    // tabela tickets não migrada
  }

  return validateLegacyOrder(id, gameId, session.name);
}

async function validateByTicketId(
  ticketId: string,
  gameId: string,
  validatedBy: string,
  requiredTypeCode?: string
): Promise<ValidateResult> {
  const db = await getDb();
  try {
    const [tk] = await db
      .select({
        id: tickets.id,
        gameId: tickets.gameId,
        status: tickets.status,
        typeName: tickets.typeName,
        typeCode: tickets.typeCode,
        validatedAt: tickets.validatedAt,
        validatedBy: tickets.validatedBy,
        orderStatus: orders.status,
        customerName: orders.customerName,
      })
      .from(tickets)
      .innerJoin(orders, eq(orders.id, tickets.orderId))
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!tk) {
      return { ok: false, reason: "not_found", message: "Ingresso não encontrado." };
    }
    if (tk.gameId !== gameId) {
      return { ok: false, reason: "wrong_game", message: "Ingresso é de outro jogo." };
    }
    if (tk.orderStatus !== "paid") {
      return { ok: false, reason: "not_paid", message: "Pedido não está pago." };
    }
    if (tk.status === "cancelled") {
      return { ok: false, reason: "not_paid", message: "Ingresso cancelado." };
    }
    if (requiredTypeCode && tk.typeCode !== requiredTypeCode) {
      return { ok: false, reason: "wrong_type", message: `Este ingresso é ${tk.typeName}.` };
    }
    if (tk.status === "validated") {
      const when = tk.validatedAt ? ` em ${fmtDateTime(tk.validatedAt as Date)}` : "";
      const by = tk.validatedBy ? ` por ${tk.validatedBy}` : "";
      return {
        ok: false,
        reason: "already_validated",
        message: `Já validado${by}${when}.`,
      };
    }

    // Marca como validado atomicamente (WHERE status='valid' evita corrida)
    const updated = await db
      .update(tickets)
      .set({ status: "validated", validatedAt: new Date(), validatedBy })
      .where(and(eq(tickets.id, ticketId), eq(tickets.status, "valid")))
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
  } catch {
    return { ok: false, reason: "error", message: "Erro interno." };
  }
}

async function validateLegacyOrder(
  orderId: string,
  gameId: string,
  validatedBy: string
): Promise<ValidateResult> {
  const db = await getDb();
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
  const db = await getDb();
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
  const db = await getDb();
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

export async function getTicketTypesForGame(gameId: string): Promise<
  { typeCode: string; typeName: string; total: number; validated: number }[]
> {
  const db = await getDb();
  try {
    const rows = await db
      .select({
        typeCode: tickets.typeCode,
        typeName: tickets.typeName,
        total: sql<number>`count(*)::int`,
        validated: sql<number>`count(case when ${tickets.status} = 'validated' then 1 end)::int`,
      })
      .from(tickets)
      .where(eq(tickets.gameId, gameId))
      .groupBy(tickets.typeCode, tickets.typeName)
      .orderBy(tickets.typeName);
    return rows.map((r) => ({
      typeCode: r.typeCode,
      typeName: r.typeName,
      total: Number(r.total),
      validated: Number(r.validated),
    }));
  } catch {
    return [];
  }
}

export async function getHomeGamesForValidation() {
  const db = await getDb();
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
