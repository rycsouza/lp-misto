"use server";

import { getDb } from "@/lib/db/client";
import { orders, orderItems, games, ticketTypes, tickets } from "@/lib/db/schema";
import { eq, isNull, asc, desc, inArray } from "drizzle-orm";
import { getAdminSession } from "./admin-auth";
import { ensureTicketsForOrder } from "@/lib/tickets/generate";
import { getSiteConfig } from "@/lib/config";
import QRCode from "qrcode";
import { signTicketToken } from "@/lib/tickets/token";

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
  | { ok: true; tickets: { id: string; qrToken: string }[]; orderId: string }
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
  if (!gameId || !typeCode || quantity < 1) {
    return { ok: false, error: "Dados inválidos." };
  }

  try {
    const db = await getDb();

    const name = recipientName.trim() || "Ingresso de Cortesia - Sistema";

    const [order] = await db
      .insert(orders)
      .values({
        customerName: name,
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

    const generatedTickets = await ensureTicketsForOrder(order.id);

    const tickets = await Promise.all(
      generatedTickets.map(async (t) => ({
        id: t.id,
        qrToken: await signTicketToken(t.id, t.gameId, t.typeCode),
      }))
    );

    return { ok: true, tickets, orderId: order.id };
  } catch (err) {
    console.error("[courtesy-tickets] error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Erro interno." };
  }
}

// ── Print data ────────────────────────────────────────────────────────────────

export interface TicketPrintData {
  ticketId: string;
  index: number;
  total: number;
  typeName: string;
  recipientName: string;
  orderId: string;
  qrDataUrl: string;
  game: {
    opponent: string;
    opponentCrestUrl: string | null;
    competition: string | null;
    venue: string;
    date: string;
  };
  clubLogoUrl: string;
  clubName: string;
}

export async function getTicketsPrintData(
  ticketIds: string[]
): Promise<TicketPrintData[] | null> {
  const session = await getAdminSession();
  if (!session) return null;

  const db = await getDb();

  const ticketRows = await db
    .select({
      id: tickets.id,
      typeName: tickets.typeName,
      typeCode: tickets.typeCode,
      gameId: tickets.gameId,
      orderId: tickets.orderId,
    })
    .from(tickets)
    .where(inArray(tickets.id, ticketIds));

  if (ticketRows.length === 0) return null;

  const orderIds = [...new Set(ticketRows.map((t) => t.orderId))];
  const gameIds = [...new Set(ticketRows.map((t) => t.gameId))];

  const [orderRows, gameRows, config] = await Promise.all([
    db
      .select({ id: orders.id, customerName: orders.customerName })
      .from(orders)
      .where(inArray(orders.id, orderIds)),
    db
      .select({
        id: games.id,
        opponent: games.opponent,
        opponentCrestUrl: games.opponentCrestUrl,
        competition: games.competition,
        venue: games.venue,
        date: games.date,
      })
      .from(games)
      .where(inArray(games.id, gameIds)),
    getSiteConfig(),
  ]);

  const orderMap = Object.fromEntries(orderRows.map((o) => [o.id, o]));
  const gameMap = Object.fromEntries(gameRows.map((g) => [g.id, g]));

  return await Promise.all(
    ticketRows.map(async (tk, i) => {
      const order = orderMap[tk.orderId];
      const game = gameMap[tk.gameId];
      const qrToken = await signTicketToken(tk.id, tk.gameId, tk.typeCode);
      const qrDataUrl = await QRCode.toDataURL(qrToken, {
        width: 280,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
      return {
        ticketId: tk.id,
        index: i,
        total: ticketRows.length,
        typeName: tk.typeName,
        recipientName: order?.customerName ?? "—",
        orderId: tk.orderId,
        qrDataUrl,
        game: {
          opponent: game?.opponent ?? "—",
          opponentCrestUrl: game?.opponentCrestUrl ?? null,
          competition: game?.competition ?? null,
          venue: game?.venue ?? "—",
          date: game?.date ? (game.date as Date).toISOString() : "",
        },
        clubLogoUrl: config.clubLogoUrl,
        clubName: "Misto EC",
      };
    })
  );
}
