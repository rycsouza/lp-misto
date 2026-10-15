/**
 * Aparência da carteirinha (funções puras, sem I/O).
 *
 * - Texto claro ou escuro conforme a luminância do fundo, pelo maior contraste WCAG.
 * - Gradiente que escurece (ou clareia) em direção ao lado do texto escolhido. Assim,
 *   a ponta do gradiente tem contraste igual ou maior que a cor base: o texto nunca
 *   perde legibilidade ao longo do cartão.
 */
import { safeCardColor } from "./plan-benefits";

/** Cor do cartão quando nem o plano nem o clube têm cor válida. */
export const FALLBACK_CARD_COLOR = "#c19a5a";
/** Cartão sem benefício (aguardando, suspenso, cancelado fora do período): cinza-ardósia, sem cor do plano. */
export const INACTIVE_CARD_COLOR = "#475569";

const TEXT_LIGHT = "#ffffff";
// Preto puro: com ele, qualquer cor de fundo tem um dos dois textos com contraste >= 4.58:1.
const TEXT_DARK = "#000000";

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(a: string, b: string, t: number): string {
  const ca = rgb(a);
  const cb = rgb(b);
  return (
    "#" +
    ca
      .map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Luminância relativa WCAG (0 = preto, 1 = branco). `hex` deve ser #RRGGBB. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG entre duas cores #RRGGBB (de 1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Cor do texto (branco ou quase-preto) com maior contraste sobre o fundo. */
export function cardTextColor(bgHex: string): string {
  return contrastRatio(bgHex, TEXT_LIGHT) >= contrastRatio(bgHex, TEXT_DARK) ? TEXT_LIGHT : TEXT_DARK;
}

export interface CardPalette {
  /** Cor do texto sobre o cartão. */
  text: string;
  /** `background` CSS do cartão (gradiente de 135°). */
  background: string;
  /** Fundo de selos/pílulas sobre o cartão, com o mesmo lado de contraste do texto. */
  pill: string;
}

/**
 * Paleta do cartão. `color` é a cor do plano (ou, sem ela, a do clube). Sem benefício
 * (`active` falso) usa a cor neutra, para não parecer um cartão em dia.
 */
export function cardPalette(color: string | null | undefined, active: boolean): CardPalette {
  const base = active ? (safeCardColor(color ?? null) ?? FALLBACK_CARD_COLOR) : INACTIVE_CARD_COLOR;
  const text = cardTextColor(base);
  const onLight = text === TEXT_LIGHT;
  const end = mixHex(base, onLight ? "#000000" : "#ffffff", 0.3);
  return {
    text,
    background: `linear-gradient(135deg, ${base} 0%, ${end} 100%)`,
    pill: onLight ? "rgba(0, 0, 0, 0.28)" : "rgba(255, 255, 255, 0.45)",
  };
}

/**
 * Véu sobre a imagem de fundo, na direção oposta ao texto: texto claro → véu escuro,
 * texto escuro → véu claro. Sutil (30% no topo, 50% embaixo), porque o texto fica no
 * topo (plano) e embaixo (nome, situação).
 */
export function cardScrim(text: string): string {
  const rgb = text === TEXT_LIGHT ? "0, 0, 0" : "255, 255, 255";
  return `linear-gradient(to bottom, rgba(${rgb}, 0.3), rgba(${rgb}, 0.5))`;
}

/**
 * Logo do clube, só se a URL for segura para `<img src>`: http(s) absoluto ou caminho
 * relativo da própria aplicação (uma barra, sem `//`). Qualquer outra coisa vira null.
 */
export function safeLogoUrl(value: string | null | undefined): string | null {
  const url = value?.trim();
  if (!url) return null;
  if (/^https?:\/\/[^\s]+$/i.test(url)) return url;
  if (/^\/(?!\/)[^\s\\]*$/.test(url)) return url;
  return null;
}
