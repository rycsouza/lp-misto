import { db } from "@/lib/db/client";
import { ticketTypes } from "@/lib/db/schema";
import { and, eq, isNull, asc, inArray, or } from "drizzle-orm";
import type { SiteConfigShape } from "@/lib/config";
import { parseBundleTiers, type BundleTier } from "@/lib/promotions/bundle";

export interface ResolvedTicketType {
  code: string;
  name: string;
  description: string | null;
  priceCents: number;
  comboTiers: BundleTier[];
}

interface GameLike {
  id: string;
  ticketPriceInteiraCents?: number | null;
  ticketPriceMeiaCents?: number | null;
  meiaEligibilityLabel?: string | null;
}

/** Slug estável a partir do nome do tipo (usado como `code`). */
export function slugifyTypeCode(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "tipo";
}

/** Fallback para o modelo antigo (Inteira/Meia do site_config + colunas do jogo). */
function legacyTypes(game: GameLike, config: SiteConfigShape): ResolvedTicketType[] {
  const inteira = game.ticketPriceInteiraCents ?? config.ticketPriceInteiraCents;
  const meia = game.ticketPriceMeiaCents ?? config.ticketPriceMeiaCents;
  const meiaDesc = game.meiaEligibilityLabel?.trim() || config.meiaEligibilityLabel || null;
  return [
    { code: "inteira", name: "Inteira", description: null, priceCents: inteira, comboTiers: [] },
    { code: "meia", name: "Meia-entrada", description: meiaDesc, priceCents: meia, comboTiers: [] },
  ];
}

type Row = typeof ticketTypes.$inferSelect;
const norm = (r: Row): ResolvedTicketType => ({
  code: r.code,
  name: r.name,
  description: r.description,
  priceCents: r.priceCents,
  comboTiers: parseBundleTiers(r.comboTiers),
});

/**
 * Resolve os tipos de ingresso de vários jogos de uma vez.
 * Prioridade: tipos do próprio jogo → catálogo global → fallback legado.
 */
export async function getTicketTypesForGames(
  games: GameLike[],
  config: SiteConfigShape
): Promise<Record<string, ResolvedTicketType[]>> {
  const ids = games.map((g) => g.id);
  let perGame: Record<string, ResolvedTicketType[]> = {};
  const global: ResolvedTicketType[] = [];

  try {
    const rows = await db
      .select()
      .from(ticketTypes)
      .where(
        and(
          eq(ticketTypes.active, true),
          ids.length > 0
            ? or(isNull(ticketTypes.gameId), inArray(ticketTypes.gameId, ids))
            : isNull(ticketTypes.gameId)
        )
      )
      .orderBy(asc(ticketTypes.sortOrder));

    perGame = {};
    for (const r of rows) {
      if (r.gameId == null) {
        global.push(norm(r));
      } else {
        (perGame[r.gameId] ??= []).push(norm(r));
      }
    }
  } catch {
    // Tabela ainda não migrada → usa fallback legado para todos
    return Object.fromEntries(games.map((g) => [g.id, legacyTypes(g, config)]));
  }

  const result: Record<string, ResolvedTicketType[]> = {};
  for (const g of games) {
    const own = perGame[g.id];
    if (own && own.length) result[g.id] = own;
    else if (global.length) result[g.id] = global;
    else result[g.id] = legacyTypes(g, config);
  }
  return result;
}

export async function getTicketTypesForGame(
  game: GameLike,
  config: SiteConfigShape
): Promise<ResolvedTicketType[]> {
  const map = await getTicketTypesForGames([game], config);
  return map[game.id];
}
