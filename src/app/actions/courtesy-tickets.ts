"use server";

import { getDb } from "@/lib/db/client";
import { orders, orderItems, games, ticketTypes, tickets, sponsors } from "@/lib/db/schema";
import { eq, and, isNull, asc, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { checkModuleAccess, requireModuleFor } from "@/lib/admin/auth-guard";
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

export interface CourtesySponsorOption {
  id: string;
  name: string;
}

export async function getCourtesyOptions(): Promise<{
  games: CourtesyGameOption[];
  globalTypes: CourtesyTypeOption[];
  sponsors: CourtesySponsorOption[];
}> {
  // Lista de jogos/tipos/patrocinadores é dado admin: permissão "jogos" + feature "cortesia".
  await requireModuleFor("jogos", "cortesia");
  const db = await getDb();
  const [gameRows, typeRows, sponsorRows] = await Promise.all([
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
    db
      .select({ id: sponsors.id, name: sponsors.name })
      .from(sponsors)
      .where(eq(sponsors.active, true))
      .orderBy(asc(sponsors.tier), asc(sponsors.order)),
  ]);

  return {
    games: gameRows.map((g) => ({
      id: g.id,
      opponent: g.opponent,
      competition: g.competition,
      date: (g.date as Date).toISOString(),
    })),
    globalTypes: typeRows.map((t) => ({ code: t.code, name: t.name })),
    sponsors: sponsorRows.map((s) => ({ id: s.id, name: s.name })),
  };
}

/** Teto por emissão: cortesias em lote acima disso pedem várias emissões (evita abuso/erro de digitação). */
const COURTESY_MAX_PER_ISSUE = 500;
/** Teto de ingressos por impressão. */
const PRINT_MAX_TICKETS = 500;

const courtesySchema = z.object({
  gameId: z.uuid(),
  typeCode: z.string().trim().min(1).max(40),
  typeName: z.string().trim().min(1).max(80),
  quantity: z.number().int().min(1).max(COURTESY_MAX_PER_ISSUE),
  recipientName: z.string().trim().max(120),
  recipientEmail: z.union([z.literal(""), z.email().max(254)]),
  sponsorId: z.uuid().nullish(),
});

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
  sponsorId?: string | null;
}): Promise<CourtesyResult> {
  // Permissão "jogos" (menu Cortesia) antes da feature "cortesia" do kill-switch.
  const access = await checkModuleAccess("jogos", "cortesia");
  if ("error" in access) return { ok: false, error: access.error };
  const session = access.session;

  const parsed = courtesySchema.safeParse({
    ...params,
    recipientName: params?.recipientName ?? "",
    recipientEmail: (params?.recipientEmail ?? "").trim(),
    sponsorId: params?.sponsorId?.trim() || null,
  });
  if (!parsed.success) {
    const qty = parsed.error.issues.some((i) => i.path[0] === "quantity");
    return {
      ok: false,
      error: qty ? `Quantidade inválida (de 1 a ${COURTESY_MAX_PER_ISSUE} por emissão).` : "Dados inválidos.",
    };
  }
  const { gameId, typeCode, typeName, quantity, recipientName, recipientEmail } = parsed.data;
  const sponsorId = parsed.data.sponsorId ?? null;

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
        ...(sponsorId ? { sponsorId } : {}),
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
    // Detalhe só no log: a mensagem do banco não vai para a tela.
    console.error("[courtesy-tickets] error:", err);
    return { ok: false, error: "Não foi possível emitir as cortesias. Tente novamente." };
  }
}

// ── Print data ────────────────────────────────────────────────────────────────

export interface TicketPrintData {
  ticketId: string;
  serialNo: number | null;
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
  sponsorLogoUrl: string | null;
  sponsorName: string | null;
  sponsorLogoTone: "light" | "dark" | null;
}

export async function getTicketsPrintData(
  ticketIds: string[]
): Promise<TicketPrintData[] | null> {
  // Imprimir é emitir a credencial (QR assinado): mesma permissão/feature da emissão.
  const access = await checkModuleAccess("jogos", "cortesia");
  if ("error" in access) return null;

  const ids = z.array(z.uuid()).min(1).max(PRINT_MAX_TICKETS).safeParse(ticketIds);
  if (!ids.success) return null;
  ticketIds = ids.data;

  const db = await getDb();

  const ticketRows = await db
    .select({
      id: tickets.id,
      serialNo: tickets.serialNo,
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

  // Patrocinador (opcional): lido de orderItems.metadata.sponsorId do item de ingresso
  const ticketItemRows = await db
    .select({ orderId: orderItems.orderId, metadata: orderItems.metadata })
    .from(orderItems)
    .where(and(inArray(orderItems.orderId, orderIds), eq(orderItems.type, "ticket")));

  const orderSponsorMap = new Map<string, string>();
  for (const it of ticketItemRows) {
    const sid = (it.metadata as { sponsorId?: string } | null)?.sponsorId;
    if (sid && !orderSponsorMap.has(it.orderId)) orderSponsorMap.set(it.orderId, sid);
  }

  const sponsorIds = [...new Set(orderSponsorMap.values())];
  const sponsorRows = sponsorIds.length > 0
    ? await db
        .select({ id: sponsors.id, name: sponsors.name, logoUrl: sponsors.logoUrl, logoTone: sponsors.logoTone })
        .from(sponsors)
        .where(inArray(sponsors.id, sponsorIds))
    : [];
  const sponsorMap = Object.fromEntries(sponsorRows.map((s) => [s.id, s]));

  return await Promise.all(
    ticketRows.map(async (tk, i) => {
      const order = orderMap[tk.orderId];
      const game = gameMap[tk.gameId];
      const sponsorId = orderSponsorMap.get(tk.orderId);
      const sponsor = sponsorId ? sponsorMap[sponsorId] : null;
      const qrToken = await signTicketToken(tk.id, tk.gameId, tk.typeCode);
      const qrDataUrl = await QRCode.toDataURL(qrToken, {
        width: 280,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
      return {
        ticketId: tk.id,
        serialNo: tk.serialNo ?? null,
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
        clubName: config.siteName,
        sponsorLogoUrl: sponsor?.logoUrl ?? null,
        sponsorName: sponsor?.name ?? null,
        sponsorLogoTone: (sponsor?.logoTone as "light" | "dark" | undefined) ?? null,
      };
    })
  );
}
