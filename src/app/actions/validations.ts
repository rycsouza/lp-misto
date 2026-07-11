"use server";

import { getDb } from "@/lib/db/client";
import { ticketValidations, orders, orderItems, games, tickets } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getAdminSession } from "@/app/actions/admin-auth";
import { requireModule } from "@/lib/admin/auth-guard";
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

  // ── Caminho UUID completo (QR direto / formato legado) ────────────────────
  const id = raw.toLowerCase();
  if (isValidUUID(id)) {
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

  // ── Caminho código NUMÉRICO: serial curto do ingresso (impresso no A4),
  //    digitado manualmente quando o QR não escaneia. Escopado ao jogo. ───────
  if (/^\d+$/.test(raw)) {
    const serial = Number(raw);
    if (Number.isSafeInteger(serial) && serial > 0) {
      const res = await validateBySerial(serial, gameId, session.name, effectiveType);
      // Se não achar por serial, ainda tenta como prefixo hex (tickets antigos).
      if (res.ok || res.reason !== "not_found") return res;
    }
  }

  // ── Caminho código curto: prefixo do ID do ingresso (8 caracteres exibidos
  //    em "Meus Pedidos"). Fallback digitável para quando o QR da tela do
  //    cliente não escaneia. Escopado ao jogo para evitar ambiguidade. ───────
  if (/^[0-9a-f]{6,12}$/.test(id)) {
    return validateByShortCode(id, gameId, session.name, effectiveType);
  }

  return { ok: false, reason: "invalid_qr", message: "Código inválido." };
}

/**
 * Valida pelo código numérico sequencial (serial_no) do ingresso — o código
 * curto impresso no A4 para digitação manual. Escopado ao jogo atual.
 */
async function validateBySerial(
  serial: number,
  gameId: string,
  validatedBy: string,
  requiredTypeCode?: string
): Promise<ValidateResult> {
  const db = await getDb();
  try {
    const rows = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(and(eq(tickets.gameId, gameId), eq(tickets.serialNo, serial)))
      .limit(1);
    if (rows.length === 0) {
      return { ok: false, reason: "not_found", message: "Nenhum ingresso com este código neste jogo." };
    }
    return validateByTicketId(rows[0].id, gameId, validatedBy, requiredTypeCode);
  } catch {
    return { ok: false, reason: "error", message: "Erro interno." };
  }
}

/**
 * Valida pelo prefixo do ID do ingresso (código curto digitável). Restringe a
 * busca ao jogo atual; exige exatamente um ingresso correspondente.
 */
async function validateByShortCode(
  prefix: string,
  gameId: string,
  validatedBy: string,
  requiredTypeCode?: string
): Promise<ValidateResult> {
  const db = await getDb();
  try {
    const rows = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(and(eq(tickets.gameId, gameId), sql`${tickets.id}::text like ${prefix + "%"}`))
      .limit(2);

    if (rows.length === 0) {
      return { ok: false, reason: "not_found", message: "Nenhum ingresso com este código neste jogo." };
    }
    if (rows.length > 1) {
      return { ok: false, reason: "invalid_qr", message: "Código ambíguo — informe mais dígitos ou escaneie o QR." };
    }
    return validateByTicketId(rows[0].id, gameId, validatedBy, requiredTypeCode);
  } catch {
    return { ok: false, reason: "error", message: "Erro interno." };
  }
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

// ─── Relatório de pós-jogo ────────────────────────────────────────────────────
// Consolida comparecimento (validações), no-show, receita e recorte por tipo/
// operador a partir do modelo por ingresso (tabela `tickets`). Área VIP ("Área
// Exclusiva") é destacada. Cortesias = whatsapp "00000000000".

/** VIP = tipo "Área Exclusiva" (case/acento-insensível). */
function isVipTypeName(name: string): boolean {
  return name.toLowerCase().includes("exclusiv");
}

export type PostGameReport = {
  game: {
    id: string;
    opponent: string;
    competition: string;
    round: string;
    date: string;
    venue: string;
  };
  hasData: boolean;
  emitted: number;
  validated: number;
  noShow: number;
  cancelled: number;
  courtesyTickets: number;
  paidTickets: number;
  attendanceRate: number; // 0..1
  revenueCents: number;
  vipPresent: number;
  vipEmitted: number;
  byType: {
    typeCode: string;
    typeName: string;
    vip: boolean;
    emitted: number;
    validated: number;
    noShow: number;
    revenueCents: number;
  }[];
  byOperator: { name: string; count: number }[];
  timeline: { hour: string; count: number }[];
  firstValidation: string | null;
  lastValidation: string | null;
};

export async function getPostGameReport(gameId: string): Promise<PostGameReport | null> {
  await requireModule("dashboard");
  if (!isValidUUID(gameId)) return null;

  const db = await getDb();
  const [g] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!g) return null;

  const game = {
    id: g.id,
    opponent: g.opponent,
    competition: g.competition,
    round: g.round,
    date: (g.date as Date).toISOString(),
    venue: g.venue,
  };

  const COURTESY = sql`${orders.customerWhatsapp} = '00000000000'`;

  let typeRows: {
    typeCode: string;
    typeName: string;
    emitted: number;
    validated: number;
    cancelled: number;
    courtesy: number;
    revenue: number;
  }[] = [];
  let byOperator: { name: string; count: number }[] = [];
  let timeline: { hour: string; count: number }[] = [];
  let firstValidation: string | null = null;
  let lastValidation: string | null = null;

  try {
    typeRows = (
      await db
        .select({
          typeCode: tickets.typeCode,
          typeName: tickets.typeName,
          emitted: sql<number>`count(*) filter (where ${tickets.status} <> 'cancelled')::int`,
          validated: sql<number>`count(*) filter (where ${tickets.status} = 'validated')::int`,
          cancelled: sql<number>`count(*) filter (where ${tickets.status} = 'cancelled')::int`,
          courtesy: sql<number>`count(*) filter (where ${tickets.status} <> 'cancelled' and ${COURTESY})::int`,
          revenue: sql<number>`coalesce(sum(${tickets.unitPriceCents}) filter (where ${tickets.status} <> 'cancelled' and ${orders.status} = 'paid' and not ${COURTESY}), 0)::int`,
        })
        .from(tickets)
        .innerJoin(orders, eq(orders.id, tickets.orderId))
        .where(eq(tickets.gameId, gameId))
        .groupBy(tickets.typeCode, tickets.typeName)
        .orderBy(tickets.typeName)
    ).map((r) => ({
      typeCode: r.typeCode,
      typeName: r.typeName,
      emitted: Number(r.emitted),
      validated: Number(r.validated),
      cancelled: Number(r.cancelled),
      courtesy: Number(r.courtesy),
      revenue: Number(r.revenue),
    }));

    byOperator = (
      await db
        .select({
          name: sql<string>`coalesce(nullif(${tickets.validatedBy}, ''), '—')`,
          count: sql<number>`count(*)::int`,
        })
        .from(tickets)
        .where(and(eq(tickets.gameId, gameId), eq(tickets.status, "validated")))
        .groupBy(sql`1`)
        .orderBy(desc(sql`count(*)`))
    ).map((r) => ({ name: r.name, count: Number(r.count) }));

    timeline = (
      await db
        .select({
          hour: sql<string>`to_char(${tickets.validatedAt} at time zone 'America/Sao_Paulo', 'HH24"h"')`,
          count: sql<number>`count(*)::int`,
        })
        .from(tickets)
        .where(and(eq(tickets.gameId, gameId), eq(tickets.status, "validated")))
        .groupBy(sql`1`)
        .orderBy(sql`1`)
    ).map((r) => ({ hour: r.hour, count: Number(r.count) }));

    const [span] = await db
      .select({
        first: sql<Date | null>`min(${tickets.validatedAt})`,
        last: sql<Date | null>`max(${tickets.validatedAt})`,
      })
      .from(tickets)
      .where(and(eq(tickets.gameId, gameId), eq(tickets.status, "validated")));
    firstValidation = span?.first ? (span.first as Date).toISOString() : null;
    lastValidation = span?.last ? (span.last as Date).toISOString() : null;
  } catch {
    /* tabela `tickets` não migrada neste tenant */
  }

  const byType = typeRows.map((r) => ({
    typeCode: r.typeCode,
    typeName: r.typeName,
    vip: isVipTypeName(r.typeName),
    emitted: r.emitted,
    validated: r.validated,
    noShow: Math.max(0, r.emitted - r.validated),
    revenueCents: r.revenue,
  }));

  const emitted = byType.reduce((a, r) => a + r.emitted, 0);
  const validated = byType.reduce((a, r) => a + r.validated, 0);
  const cancelled = typeRows.reduce((a, r) => a + r.cancelled, 0);
  const courtesyTickets = typeRows.reduce((a, r) => a + r.courtesy, 0);
  const revenueCents = typeRows.reduce((a, r) => a + r.revenue, 0);
  const vipEmitted = byType.filter((r) => r.vip).reduce((a, r) => a + r.emitted, 0);
  const vipPresent = byType.filter((r) => r.vip).reduce((a, r) => a + r.validated, 0);

  return {
    game,
    hasData: emitted > 0,
    emitted,
    validated,
    noShow: Math.max(0, emitted - validated),
    cancelled,
    courtesyTickets,
    paidTickets: Math.max(0, emitted - courtesyTickets),
    attendanceRate: emitted > 0 ? validated / emitted : 0,
    revenueCents,
    vipPresent,
    vipEmitted,
    byType,
    byOperator,
    timeline,
    firstValidation,
    lastValidation,
  };
}
