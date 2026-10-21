/**
 * Hierarquia visual do Mural dos Sócios (funções puras, sem I/O).
 *
 * O nível (tier) vem de wall.ts: 0 = plano mais caro do mural. Daí sai a posição (topo, meio
 * ou entrada), o tamanho do cartão e a cor. Cor do plano quando válida; sem cor, a paleta de
 * reserva por nível (ouro, prata, bronze e tons neutros), nunca cinza.
 */
import { cardPalette, contrastRatio } from "./card-visual";
import { safeCardColor } from "./plan-benefits";

export type WallRank = "top" | "mid" | "entry";

/**
 * Paleta de reserva por nível (hex fixo). Os níveis além do fim da lista usam o último tom.
 * Cada par é escolhido para que o texto (branco ou preto) tenha contraste AA nas duas pontas.
 */
export const WALL_TIER_PALETTE = [
  { from: "#c9a227", to: "#9a7a1e" }, // ouro
  { from: "#cbd5e1", to: "#6b7c93" }, // prata
  { from: "#b45309", to: "#78350f" }, // bronze
  { from: "#475569", to: "#334155" }, // ardósia
  { from: "#57534e", to: "#44403c" }, // pedra
  { from: "#52525b", to: "#3f3f46" }, // zinco
] as const;

const TEXT_LIGHT = "#ffffff";
const TEXT_DARK = "#000000";

/** Posição do nível: topo (o mais caro), entrada (o mais barato, se houver mais de um) ou meio. */
export function wallRank(tier: number, tierCount: number): WallRank {
  if (tier <= 0) return "top";
  if (tierCount > 1 && tier >= tierCount - 1) return "entry";
  return "mid";
}

/** Quantidade de níveis presentes (0 se não houver cartões). */
export function wallTierCount(tiers: readonly number[]): number {
  return tiers.reduce((max, t) => Math.max(max, t), -1) + 1;
}

/** Ordena do topo para a entrada; empate de nível mantém a ordem do dia (sort é estável). */
export function sortByTier<T extends { tier: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.tier - b.tier);
}

/**
 * Largura do cartão por posição: o topo é o maior, a entrada o menor, com o meio decrescendo.
 * Classes literais (o Tailwind precisa enxergá-las no código). O mínimo (w-36) fica em 144 px,
 * o passo usado para dimensionar as faixas do carrossel.
 */
export function wallCardSizeClass(tier: number, tierCount: number): string {
  const rank = wallRank(tier, tierCount);
  if (rank === "top") return "w-44 sm:w-56";
  if (rank === "entry") return "w-36 sm:w-40";
  return tier === 1 ? "w-40 sm:w-48" : "w-38 sm:w-44";
}

/** Par da paleta de reserva para o nível, com o texto de maior contraste mínimo nas duas pontas. */
export function wallPaletteAt(tier: number): { from: string; to: string; text: string } {
  const index = Math.min(Math.max(tier, 0), WALL_TIER_PALETTE.length - 1);
  const { from, to } = WALL_TIER_PALETTE[index];
  const white = Math.min(contrastRatio(from, TEXT_LIGHT), contrastRatio(to, TEXT_LIGHT));
  const black = Math.min(contrastRatio(from, TEXT_DARK), contrastRatio(to, TEXT_DARK));
  return { from, to, text: white >= black ? TEXT_LIGHT : TEXT_DARK };
}

export interface WallFill {
  /** `background` CSS (gradiente de 135°) para avatar e etiqueta. */
  background: string;
  /** Cor do texto sobre o fundo acima. */
  text: string;
  /** Cor de destaque (anel do topo e ponto da legenda), #rrggbb. */
  accent: string;
}

/**
 * Preenchimento do cartão: a cor recebida (a do plano, ou a do clube aplicada por
 * withClubColorFallback), senão a paleta de reserva do nível. Nunca devolve cinza.
 */
export function wallCardFill(planColor: string | null | undefined, tier: number): WallFill {
  const color = safeCardColor(planColor ?? null);
  if (color) {
    const palette = cardPalette(color, true);
    return { background: palette.background, text: palette.text, accent: color };
  }
  const pal = wallPaletteAt(tier);
  return {
    background: `linear-gradient(135deg, ${pal.from} 0%, ${pal.to} 100%)`,
    text: pal.text,
    accent: pal.from,
  };
}

/**
 * Plano sem cor própria usa a COR DO CLUBE (como a carteirinha). A paleta por nível
 * só entra se nem o clube tiver cor válida. Só hex validado passa.
 */
export function withClubColorFallback<T extends { cardColor: string | null }>(
  cards: readonly T[],
  clubColor: string | null | undefined
): T[] {
  const club = safeCardColor(clubColor ?? null);
  return cards.map((c) => (safeCardColor(c.cardColor) || !club ? c : { ...c, cardColor: club }));
}
