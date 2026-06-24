"use server";

import { getDb } from "@/lib/db/client";
import { orders, orderItems, games, ticketTypes } from "@/lib/db/schema";
import { eq, isNull, asc, desc } from "drizzle-orm";
import { getAdminSession } from "./admin-auth";
import { ensureTicketsForOrder } from "@/lib/tickets/generate";

export interface CourtesyGameOption {
  id: string;
  opponent: string;
  competition: string | null;
  date: string;
}

export interface CourtesyTypeOption {
  code: string;
  name: string;
}

export async function getCourtesyOptions(): Promise<{
  games: CourtesyGameOption[];
  globalTypes: CourtesyTypeOption[];
}> {
  const db = await getDb();
  const [gameRows, typeRows] = await Promise.all([
    db
      .select({ id: games.id, opponent: games.opponent, competition: games.competition, date: games.date })
      .from(games)
      .where(eq(games.isHome, true))
      .orderBy(desc(games.date))
      .limit(20),
    db
      .select({ code: ticketTypes.code, name: ticketTypes.name })
      .from(ticketTypes)
      .where(isNull(ticketTypes.gameId))
      .orderBy(asc(ticketTypes.sortOrder)),
  ]);

  return {
    games: gameRows.map((g) => ({
      id: g.id,
      opponent: g.opponent,
      competition: g.competition,
      date: (g.date as Date).toISOString(),
    })),
    globalTypes: typeRows.map((t) => ({ code: t.code, name: t.name })),
  };
}

export type CourtesyResult =
  | { ok: true; ticketIds: string[]; orderId: string }
  | { ok: false; error: string };

export async function createCourtesyTickets(params: {
  gameId: string;
  typeCode: string;
  typeName: string;
  quantity: number;
  recipientName: string;
  recipientEmail: string;
}): Promise<CourtesyResult> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: "Não autenticado." };
  if (session.role !== "admin" && !session.permissions?.jogos) {
    return { ok: false, error: "Sem permissão." };
  }

  const { gameId, typeCode, typeName, quantity, recipientName, recipientEmail } = params;
  if (!gameId || !typeCode || quantity < 1 || !recipientName.trim()) {
    return { ok: false, error: "Dados inválidos." };
  }

  try {
    const db = await getDb();

    const [order] = await db
      .insert(orders)
      .values({
        customerName: recipientName.trim(),
        customerEmail: recipientEmail.trim() || `cortesia@noreply.local`,
        customerWhatsapp: "00000000000",
        status: "paid",
        totalCents: 0,
      })
      .returning({ id: orders.id });

    await db.insert(orderItems).values({
      orderId: order.id,
      type: "ticket",
      referenceId: gameId,
      quantity,
      unitPriceCents: 0,
      metadata: {
        ticketType: typeCode,
        typeName,
        isCourtesy: true,
        issuedBy: session.name,
      },
    });

    const tickets = await ensureTicketsForOrder(order.id);

    return { ok: true, ticketIds: tickets.map((t) => t.id), orderId: order.id };
  } catch (err) {
    console.error("[courtesy-tickets] error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Erro interno." };
  }
}
