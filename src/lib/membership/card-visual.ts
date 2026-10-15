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
  /** Sombra leve do texto: legibilidade sobre a imagem de fundo (só usada com imagem). */
  textShadow: string;
}

/** Contraste mínimo WCAG AA para texto normal. */
const AA_MIN_CONTRAST = 4.5;

function rgbToHsl(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  if (s === 0) {
    const v = Math.round(l * 255).toString(16).padStart(2, "0");
    return `#${v}${v}${v}`;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t0: number) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return (
    "#" +
    [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)]
      .map((v) => Math.round(v * 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Mesma cor com a saturação multiplicada (limitada a 100%) e a luminosidade mantida. */
function saturateHex(hex: string, factor: number): string {
  const [h, s, l] = rgbToHsl(hex);
  return hslToHex(h, Math.min(1, s * factor), l);
}

/**
 * Ponta do gradiente: a cor base puxada para o lado do texto (escura com texto claro,
 * clara com texto escuro), com mais saturação para ficar viva e não cinza. Só vale se
 * continuar com contraste AA contra o texto; senão, fica a mistura simples (que já é AA).
 */
function gradientEnd(base: string, text: string): string {
  const onLight = text === TEXT_LIGHT;
  const plain = mixHex(base, onLight ? TEXT_DARK : "#ffffff", 0.3);
  const rich = saturateHex(plain, 1.15);
  return contrastRatio(rich, text) >= AA_MIN_CONTRAST ? rich : plain;
}

/**
 * Paleta do cartão. Precedência fixa da cor de base:
 * 1. cor do PLANO (`planColor`), se for #RRGGBB válida;
 * 2. cor do CLUBE (`clubColor`), só se o plano não tiver cor;
 * 3. dourado de reserva, só se nenhuma das duas existir.
 * Sem benefício (`active` falso) usa o cinza neutro, ignorando as duas cores.
 */
export function cardPalette(
  planColor: string | null | undefined,
  active: boolean,
  clubColor?: string | null,
): CardPalette {
  const base = active
    ? (safeCardColor(planColor ?? null) ?? safeCardColor(clubColor ?? null) ?? FALLBACK_CARD_COLOR)
    : INACTIVE_CARD_COLOR;
  const text = cardTextColor(base);
  const onLight = text === TEXT_LIGHT;
  return {
    text,
    background: `linear-gradient(135deg, ${base} 0%, ${gradientEnd(base, text)} 100%)`,
    pill: onLight ? "rgba(0, 0, 0, 0.28)" : "rgba(255, 255, 255, 0.45)",
    textShadow: onLight ? "0 1px 2px rgba(0, 0, 0, 0.6)" : "0 1px 2px rgba(255, 255, 255, 0.5)",
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
