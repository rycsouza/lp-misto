/**
 * Desconto progressivo por número de jogos distintos no carrinho de ingressos.
 * Ex.: 2 jogos → 10%, 3+ jogos → 15%. Configurável em site_config (ticketBundleTiers).
 */

export interface BundleTier {
  games: number; // nº mínimo de jogos distintos para a faixa
  pct: number; // percentual de desconto (0–100)
}

/** Normaliza o valor cru da config (string JSON, array ou nulo) em faixas válidas, ordenadas. */
export function parseBundleTiers(raw: unknown): BundleTier[] {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((t) => ({ games: Number((t as BundleTier)?.games), pct: Number((t as BundleTier)?.pct) }))
    .filter((t) => Number.isFinite(t.games) && t.games >= 2 && Number.isFinite(t.pct) && t.pct > 0)
    .sort((a, b) => a.games - b.games);
}

export interface BundleResult {
  pct: number;
  games: number; // faixa aplicada (0 se nenhuma)
  discountCents: number;
}

/**
 * Calcula o desconto de combo aplicado sobre `baseCents` (subtotal só de ingressos),
 * escolhendo a faixa de maior exigência que o número de jogos distintos atende.
 */
export function computeBundleDiscount(
  distinctGames: number,
  baseCents: number,
  tiers: BundleTier[]
): BundleResult {
  const eligible = parseBundleTiers(tiers).filter((t) => distinctGames >= t.games);
  if (eligible.length === 0) return { pct: 0, games: 0, discountCents: 0 };
  // mais exigente (maior nº de jogos) vence
  const best = eligible[eligible.length - 1];
  return {
    pct: best.pct,
    games: best.games,
    discountCents: Math.round((baseCents * best.pct) / 100),
  };
}
