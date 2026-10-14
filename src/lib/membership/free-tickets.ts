import { randomUUID } from "node:crypto";
import { reserveTicketStock, releaseTicketStockById } from "@/lib/tickets/reserve";
import { and, asc, count, eq, gt, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { games, memberTicketRedemptions, membershipPlans, orderItems, orders } from "@/lib/db/schema";
import { ticketSalesOpen } from "@/lib/db/queries";
import { getSiteConfig } from "@/lib/config";
import { getTicketTypesForGames } from "@/lib/tickets/resolve";
import { ensureTicketsForOrder } from "@/lib/tickets/generate";
import { memberHasBenefits } from "@/lib/membership/status";
import { FREE_TICKET_BLOCK_MESSAGE, type FreeTicketBlock } from "@/lib/membership/free-ticket-blocks";

export type { FreeTicketBlock };

/**
 * Ingresso grátis do plano por jogo em casa (resgate na área logada).
 *
 * INTERNO: fica fora dos arquivos "use server" (lá só entram as actions de
 * src/app/actions/account.ts, que já checam a sessão e leem o sócio pelo e-mail
 * da conta). Quem chama passa o sócio e a conta JÁ CONFIRMADOS pela sessão — o
 * client nunca escolhe o memberId.
 *
 * O limite por jogo é garantido no banco: a reserva insere em
 * member_ticket_redemptions (memberId, gameId, seq) com unique; sem linha de
 * retorno = corrida ou limite → recusa antes de criar pedido.
 */

export interface FreeTicketMember {
  id: string;
  name: string;
  planId: string | null;
  status: string;
  nextBillingDate: Date | null;
  hasPaid: boolean;
}

export interface FreeTicketAccount {
  email: string;
  whatsapp: string | null;
}

export interface FreeTicketGameView {
  id: string;
  opponent: string;
  competition: string | null;
  round: string;
  date: string;
  venue: string;
  /** Ingressos já resgatados neste jogo. */
  used: number;
  /** Limite do plano por jogo em casa. */
  limit: number;
  canRedeem: boolean;
  block: FreeTicketBlock | null;
}

export type MyFreeTickets =
  | { eligible: false }
  | { eligible: true; planName: string; perGame: number; games: FreeTicketGameView[] };

export type RedeemResult =
  | { ok: true; orderId: string; message: string }
  | { ok: false; error: string };

const UNAVAILABLE = "Não foi possível resgatar agora. Tente novamente em alguns minutos.";

/**
 * Jogo elegível para resgate: em casa, ativo, futuro e com venda aberta. Sem
 * `ticketSalesEndsAt`, a venda do SQL (ticketSalesOpen) fecha só no fim do dia do
 * jogo, que é depois do kickoff; como exigimos jogo futuro, basta checar o
 * encerramento explícito.
 */
export function isBookableHomeGame(
  g: { isHome: boolean; active: boolean; date: Date; ticketSalesEndsAt: Date | null },
  now: Date = new Date()
): boolean {
  if (!g.isHome || !g.active) return false;
  if (g.date.getTime() <= now.getTime()) return false;
  return g.ticketSalesEndsAt === null || now.getTime() < g.ticketSalesEndsAt.getTime();
}

/** Bloqueio de nível do sócio (vale para todos os jogos). null = pode resgatar. */
export function memberBlock(
  member: Pick<FreeTicketMember, "status" | "nextBillingDate" | "hasPaid">,
  account: FreeTicketAccount,
  now: Date = new Date()
): FreeTicketBlock | null {
  if (!memberHasBenefits(member, now)) return "inactive";
  // Anti-abuso do 1º mês grátis: sem nenhuma mensalidade paga, não resgata.
  if (!member.hasPaid) return "not_paid";
  if (!account.whatsapp) return "no_whatsapp";
  return null;
}

async function loadPlanPerGame(planId: string | null): Promise<{ name: string; perGame: number } | null> {
  if (!planId) return null;
  const db = await getDb();
  const [plan] = await db
    .select({ name: membershipPlans.name, perGame: membershipPlans.freeTicketsPerHomeGame })
    .from(membershipPlans)
    .where(eq(membershipPlans.id, planId))
    .limit(1);
  return plan && plan.perGame > 0 ? plan : null;
}

const gameCols = {
  id: games.id,
  opponent: games.opponent,
  competition: games.competition,
  round: games.round,
  date: games.date,
  venue: games.venue,
  isHome: games.isHome,
  active: games.active,
  ticketSalesEndsAt: games.ticketSalesEndsAt,
  ticketPriceInteiraCents: games.ticketPriceInteiraCents,
  ticketPriceMeiaCents: games.ticketPriceMeiaCents,
  meiaEligibilityLabel: games.meiaEligibilityLabel,
};

/** Próximos jogos em casa (mesma regra da página de ingressos) e o estado do sócio em cada um. */
export async function getMyFreeTicketsView(
  member: FreeTicketMember,
  account: FreeTicketAccount,
  now: Date = new Date()
): Promise<MyFreeTickets> {
  const plan = await loadPlanPerGame(member.planId);
  if (!plan) return { eligible: false };

  const db = await getDb();
  const rows = await db
    .select({
      id: games.id,
      opponent: games.opponent,
      competition: games.competition,
      round: games.round,
      date: games.date,
      venue: games.venue,
    })
    .from(games)
    .where(and(eq(games.isHome, true), eq(games.active, true), gt(games.date, now), ticketSalesOpen()))
    .orderBy(asc(games.date))
    .limit(20);

  const gameIds = rows.map((g) => g.id);
  const usedRows = gameIds.length
    ? await db
        .select({ gameId: memberTicketRedemptions.gameId, n: count() })
        .from(memberTicketRedemptions)
        .where(and(eq(memberTicketRedemptions.memberId, member.id), inArray(memberTicketRedemptions.gameId, gameIds)))
        .groupBy(memberTicketRedemptions.gameId)
    : [];
  const usedByGame = new Map(usedRows.map((r) => [r.gameId, Number(r.n)]));

  const generalBlock = memberBlock(member, account, now);
  const limit = plan.perGame;

  return {
    eligible: true,
    planName: plan.name,
    perGame: limit,
    games: rows.map((g) => {
      const used = usedByGame.get(g.id) ?? 0;
      const block = generalBlock ?? (used >= limit ? "limit_reached" : null);
      return {
        id: g.id,
        opponent: g.opponent,
        competition: g.competition,
        round: g.round,
        date: g.date.toISOString(),
        venue: g.venue,
        used,
        limit,
        canRedeem: block === null,
        block,
      };
    }),
  };
}

function fail(error: string): RedeemResult {
  return { ok: false, error };
}

/**
 * Resgata 1 ingresso grátis do sócio para um jogo em casa. Cria um pedido R$ 0
 * já pago (dados do comprador = sócio + conta da sessão), gera o ingresso e
 * envia o e-mail com o QR. Se o pedido falhar, a reserva é apagada (libera a vaga).
 */
export async function redeemFreeTicket(
  member: FreeTicketMember,
  account: FreeTicketAccount,
  gameId: string,
  now: Date = new Date()
): Promise<RedeemResult> {
  try {
    const plan = await loadPlanPerGame(member.planId);
    if (!plan) return fail("Seu plano não inclui ingresso grátis em jogos em casa.");

    const block = memberBlock(member, account, now);
    if (block) return fail(FREE_TICKET_BLOCK_MESSAGE[block]);
    const whatsapp = account.whatsapp;
    if (!whatsapp) return fail(FREE_TICKET_BLOCK_MESSAGE.no_whatsapp);

    const db = await getDb();
    const [game] = await db.select(gameCols).from(games).where(eq(games.id, gameId)).limit(1);
    if (!game || !isBookableHomeGame(game, now)) {
      return fail("Este jogo não está disponível para resgate.");
    }

    const config = await getSiteConfig();
    const [ticketType] = (await getTicketTypesForGames([game], config))[game.id] ?? [];
    if (!ticketType) return fail("Este jogo ainda não tem tipo de ingresso cadastrado. Fale com o clube.");

    const [countRow] = await db
      .select({ n: count() })
      .from(memberTicketRedemptions)
      .where(and(eq(memberTicketRedemptions.memberId, member.id), eq(memberTicketRedemptions.gameId, game.id)));
    const used = Number(countRow?.n ?? 0);
    if (used >= plan.perGame) return fail(FREE_TICKET_BLOCK_MESSAGE.limit_reached);

    // Reserva da vaga: a 1ª posição livre entre 1..limite (o índice único garante
    // o teto mesmo em corrida). Tentar todas evita "vaga presa" se uma reserva
    // anterior foi liberada fora de ordem. Nenhuma livre → limite atingido.
    let reserva: { id: string } | undefined;
    let seq = 0;
    for (let s = 1; s <= plan.perGame && !reserva; s++) {
      [reserva] = await db
        .insert(memberTicketRedemptions)
        .values({ memberId: member.id, gameId: game.id, seq: s })
        .onConflictDoNothing()
        .returning({ id: memberTicketRedemptions.id });
      seq = s;
    }
    if (!reserva) return fail(FREE_TICKET_BLOCK_MESSAGE.limit_reached);

    // Estoque: o ingresso de sócio ocupa lugar como uma venda (tipos com teto).
    const stockLine =
      ticketType.id && ticketType.maxQuantity != null
        ? [{ id: ticketType.id, name: ticketType.name, quantity: 1 }]
        : [];
    if (stockLine.length > 0) {
      const stock = await reserveTicketStock(db, stockLine);
      if (!stock.ok) {
        await db.delete(memberTicketRedemptions).where(eq(memberTicketRedemptions.id, reserva.id));
        return fail("Os ingressos deste jogo esgotaram.");
      }
    }

    const orderId = randomUUID();
    try {
      // Neon HTTP não tem transaction interativa: o batch roda como uma transação só.
      await db.batch([
        db.insert(orders).values({
          id: orderId,
          customerName: member.name,
          customerEmail: account.email,
          customerWhatsapp: whatsapp,
          status: "paid",
          totalCents: 0,
        }),
        db.insert(orderItems).values({
          orderId,
          type: "ticket",
          referenceId: game.id,
          quantity: 1,
          unitPriceCents: 0,
          metadata: {
            ticketType: ticketType.code,
            typeName: ticketType.name,
            isMemberFreeTicket: true,
            memberId: member.id,
            planName: plan.name,
          },
        }),
        db
          .update(memberTicketRedemptions)
          .set({ orderId })
          .where(eq(memberTicketRedemptions.id, reserva.id)),
      ]);
    } catch (err) {
      // Sem o erro bruto: a mensagem do driver pode trazer os parâmetros (e-mail, WhatsApp).
      console.error("[socio] falha ao criar pedido do ingresso grátis", {
        memberId: member.id,
        gameId: game.id,
        code: (err as { code?: string } | null)?.code ?? null,
      });
      const reservaId = reserva.id;
      await db
        .delete(memberTicketRedemptions)
        .where(eq(memberTicketRedemptions.id, reservaId))
        .catch((e) => console.error("[socio] falha ao liberar reserva do ingresso grátis:", e));
      await releaseTicketStockById(db, stockLine).catch((e) =>
        console.error("[socio] falha ao devolver estoque do ingresso grátis:", e)
      );
      return fail(UNAVAILABLE);
    }

    // Idempotente; se falhar, a aba de pedidos gera os ingressos na próxima leitura.
    await ensureTicketsForOrder(orderId).catch((err) =>
      console.error("[socio] falha ao gerar ingresso grátis:", err)
    );
    // E-mail com o QR (fire-and-forget: não quebra o resgate).
    import("@/lib/email")
      .then(({ sendOrderConfirmation }) => sendOrderConfirmation(orderId))
      .catch((err) => console.error("[socio] falha ao enviar e-mail do ingresso grátis:", err));

    console.info("[socio] ingresso grátis resgatado", { memberId: member.id, gameId: game.id, orderId, seq });
    return {
      ok: true,
      orderId,
      message: "Ingresso resgatado! Ele está em \"Pedidos e ingressos\", com o QR Code para a entrada.",
    };
  } catch (err) {
    console.error("[socio] erro ao resgatar ingresso grátis", {
      memberId: member.id,
      gameId,
      code: (err as { code?: string } | null)?.code ?? null,
    });
    return fail(UNAVAILABLE);
  }
}
