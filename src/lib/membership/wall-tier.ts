/**
 * Hierarquia visual do Mural dos Sócios (funções puras, sem I/O).
 *
 * O nível (tier) vem de wall.ts: 0 = plano mais caro do mural. Daí saem a posição (topo, meio
 * ou entrada), o tamanho do tile (interpolado pelo nível), o anel e a cor. Cor do plano quando
 * válida; sem cor, a paleta de reserva por nível (ouro, prata, bronze e tons neutros), nunca cinza.
 *
 * Aparência orgânica: cada tile tem deslocamento vertical, margem, leve variação de tamanho e
 * ritmo de flutuação próprios. Tudo sai de um hash estável da chave do tile (FNV-1a + avalanche):
 * a mesma entrada gera o mesmo visual no servidor e no cliente, sem gerador aleatório no render.
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

/** Diâmetro em px: no celular (abaixo de sm, 640 px) e a partir de sm. */
export interface WallSize {
  mobile: number;
  desktop: number;
}

/** Topo (o mais caro): ~104–120 px no desktop e ~84–92 px no celular. */
export const WALL_TOP_SIZE: WallSize = { mobile: 88, desktop: 112 };
/** Entrada (o mais barato, com 2 níveis ou mais): ~56–64 px no desktop e ~48–52 px no celular. */
export const WALL_ENTRY_SIZE: WallSize = { mobile: 50, desktop: 60 };
/** Vaga "Seu lugar": a menor do mosaico (~44–52 px no desktop e 40 px no celular). */
export const WALL_VAGA_SIZE: WallSize = { mobile: 40, desktop: 48 };

/** Variação de tamanho por tile: ±6% sobre o diâmetro do nível. */
export const WALL_SCALE_SPREAD = 0.06;
/** Deslocamento vertical máximo (± px) de cada tile dentro da sua fileira. */
export const WALL_DY_MAX_PX = 12;
/** Margem à esquerda de cada tile (px), escolhida de forma determinística nesta faixa. */
export const WALL_MARGIN_MIN_PX = 4;
export const WALL_MARGIN_MAX_PX = 22;

/**
 * Diâmetro do nível: interpola do topo (tier 0) até a entrada (último tier). Com 3 ou mais níveis,
 * os do meio ficam escalonados. Um nível só (ou nenhum) usa o tamanho do topo.
 */
export function wallSizeAt(tier: number, tierCount: number): WallSize {
  const last = tierCount - 1;
  const frac = last <= 0 ? 0 : Math.min(Math.max(tier, 0), last) / last;
  const at = (from: number, to: number) => Math.round(from + (to - from) * frac);
  return {
    mobile: at(WALL_TOP_SIZE.mobile, WALL_ENTRY_SIZE.mobile),
    desktop: at(WALL_TOP_SIZE.desktop, WALL_ENTRY_SIZE.desktop),
  };
}

/** Aparência de um tile: tamanho, posição e flutuação, todos determinísticos. */
export interface WallTileLook {
  /** Diâmetro no celular e a partir de sm (px), já com a variação do tile. */
  mobilePx: number;
  desktopPx: number;
  /** Deslocamento vertical (px), entre -WALL_DY_MAX_PX e +WALL_DY_MAX_PX. */
  dyPx: number;
  /** Margem à esquerda do tile (px), entre WALL_MARGIN_MIN_PX e WALL_MARGIN_MAX_PX. */
  marginPx: number;
  /** Flutuação: amplitude (px), ida e volta (s) e atraso inicial (s, negativo = fase). */
  bobAmpPx: number;
  bobSec: number;
  bobDelaySec: number;
  /** Menor espaço que o tile ocupa na fileira (margem + diâmetro mínimo), por tela. */
  minSlotMobilePx: number;
  minSlotDesktopPx: number;
}

/** FNV-1a de 32 bits com avalanche (murmur fmix32). Mesma string, mesmo número, sempre. */
export function wallHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Valor em [0, 1) para uma chave e um sal (cada atributo do tile tem o seu sal). */
function unitFor(key: string, salt: string): number {
  return wallHash(`${salt}|${key}`) / 0x100000000;
}

/**
 * Aparência do tile para a chave dada (ex.: nome + posição na fileira). O tamanho sai do
 * diâmetro base recebido, com a variação de ±WALL_SCALE_SPREAD. Os mínimos (minSlot*) valem
 * para qualquer chave e são usados para garantir que a sequência da fileira é mais larga que a tela.
 */
export function wallTileLook(key: string, base: WallSize): WallTileLook {
  const scale = 1 + (unitFor(key, "escala") * 2 - 1) * WALL_SCALE_SPREAD;
  const bobSec = Math.round((3.2 + unitFor(key, "ritmo") * 2.4) * 10) / 10;
  return {
    mobilePx: Math.round(base.mobile * scale),
    desktopPx: Math.round(base.desktop * scale),
    dyPx: -WALL_DY_MAX_PX + Math.floor(unitFor(key, "deslocamento") * (2 * WALL_DY_MAX_PX + 1)),
    marginPx: WALL_MARGIN_MIN_PX + Math.floor(unitFor(key, "margem") * (WALL_MARGIN_MAX_PX - WALL_MARGIN_MIN_PX + 1)),
    bobAmpPx: 3 + Math.floor(unitFor(key, "amplitude") * 5),
    bobSec,
    bobDelaySec: -Math.round(unitFor(key, "fase") * bobSec * 10) / 10,
    minSlotMobilePx: WALL_MARGIN_MIN_PX + Math.round(base.mobile * (1 - WALL_SCALE_SPREAD)),
    minSlotDesktopPx: WALL_MARGIN_MIN_PX + Math.round(base.desktop * (1 - WALL_SCALE_SPREAD)),
  };
}

/** Anel do tile: mais grosso no topo, fino na entrada. */
export function wallRingPx(rank: WallRank): number {
  if (rank === "top") return 3;
  if (rank === "entry") return 1;
  return 2;
}

/**
 * Ordem do mosaico (sócios, antes das vagas). Os do topo (nível 0) são espalhados em posições
 * igualmente distantes entre si, para não ficarem amontoados numa fileira ou numa ponta. Os
 * demais preenchem as posições livres na ordem do nível (mais caro primeiro). Determinístico.
 */
export function arrangeWall<T extends { tier: number }>(cards: readonly T[]): T[] {
  const sorted = sortByTier(cards);
  const top = sorted.filter((c) => c.tier === 0);
  const rest = sorted.filter((c) => c.tier !== 0);
  const total = sorted.length;
  const topAt = new Set<number>();
  for (let j = 0; j < top.length; j++) topAt.add(Math.floor(((j + 0.5) * total) / top.length));
  let t = 0;
  let r = 0;
  return Array.from({ length: total }, (_, i) => (topAt.has(i) ? top[t++] : rest[r++]));
}

/** Texto do contador do topo: o N é o total real de sócios no mural. */
export function wallCounterText(total: number): string {
  return total === 1 ? "1 torcedor já é sócio" : `${total} torcedores já são sócios`;
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
