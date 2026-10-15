/**
 * Fundo da carteirinha escolhido pelo CLUBE (uma configuração, vale para todos os planos).
 *
 * Módulo puro e seguro para o cliente: sem env, sem I/O. Quem chama passa o nome do
 * bucket de upload (CLOUDINARY_CLOUD_NAME). Aceita só:
 * - https absoluta do DESTINO DE UPLOAD do projeto (res.cloudinary.com/<cloud>/image/upload/...);
 * - caminho relativo do próprio site ("/arquivo.png"), sem "//" nem barra invertida.
 * Recusa http, data:, javascript:, outro host, credenciais, porta, espaços, aspas e "..".
 *
 * A imagem é renderizada como <img> (nunca background-image com url() montada em string).
 */
import { z } from "zod";

/** Chaves de configuração (tabela siteConfig) do fundo da carteirinha. */
export const MEMBER_CARD_BACKGROUND_KEYS = [
  "memberCardBackgroundUrl",
  "memberCardBackgroundFit",
  "memberCardBackgroundOpacity",
] as const;

export const CARD_BACKGROUND_FITS = ["cover", "contain"] as const;
export type CardBackgroundFit = (typeof CARD_BACKGROUND_FITS)[number];

export const CARD_BACKGROUND_FIT_DEFAULT: CardBackgroundFit = "cover";
export const CARD_BACKGROUND_OPACITY_MIN = 10;
export const CARD_BACKGROUND_OPACITY_MAX = 100;
export const CARD_BACKGROUND_OPACITY_DEFAULT = 100;

/** Fundo já validado, pronto para renderizar. */
export interface MemberCardBackground {
  url: string;
  fit: CardBackgroundFit;
  /** Inteiro de 10 a 100 (porcentagem). */
  opacity: number;
}

const URL_MAX_CHARS = 2048;
const UPLOAD_ORIGIN = "https://res.cloudinary.com";
const CLOUD_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;
/** Só caracteres visíveis ASCII, sem espaço, aspas, <, > nem barra invertida. */
const VISIBLE_SAFE_RE = /^[\x21-\x7e]+$/;
const UNSAFE_CHARS_RE = /["'<>\\`]/;
/** Caminho relativo do próprio site: uma barra, sem "//" nem "/\" no início. */
const RELATIVE_PATH_RE = /^\/(?![/\\])[\w.~%\-/]+$/;
/** Segmentos "." ou ".." no caminho. */
const DOT_SEGMENT_RE = /(^|\/)\.\.?(\/|$)/;

/**
 * URL do fundo, só se for segura. Devolve a própria URL (aparada) ou null.
 * `cloudName` null ou inválido: só caminho relativo é aceito (fail closed).
 */
export function safeCardBackgroundUrl(value: unknown, cloudName: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url || url.length > URL_MAX_CHARS) return null;

  if (RELATIVE_PATH_RE.test(url) && !DOT_SEGMENT_RE.test(url)) return url;

  if (!VISIBLE_SAFE_RE.test(url) || UNSAFE_CHARS_RE.test(url)) return null;
  if (!cloudName || !CLOUD_NAME_RE.test(cloudName)) return null;
  if (DOT_SEGMENT_RE.test(url)) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (parsed.origin !== UPLOAD_ORIGIN) return null;
  if (parsed.username || parsed.password || parsed.port) return null;
  if (!parsed.pathname.startsWith(`/${cloudName}/image/upload/`)) return null;
  return url;
}

/**
 * Fonte que a carteirinha pode pôr em `<img src>` (defesa em profundidade na tela):
 * https absoluta ou caminho relativo seguro. O destino de upload é decidido antes,
 * em `safeCardBackgroundUrl`.
 */
export function isRenderableBackgroundSrc(value: string): boolean {
  if (typeof value !== "string" || value.length > URL_MAX_CHARS) return false;
  if (RELATIVE_PATH_RE.test(value) && !DOT_SEGMENT_RE.test(value)) return true;
  return /^https:\/\/[^\s"'<>\\`]+$/i.test(value) && !DOT_SEGMENT_RE.test(value);
}

export function normalizeCardBackgroundFit(value: unknown): CardBackgroundFit {
  return value === "contain" ? "contain" : CARD_BACKGROUND_FIT_DEFAULT;
}

/** Opacidade inteira de 10 a 100. Valor fora da faixa (ou ausente) vira 100. */
export function normalizeCardBackgroundOpacity(value: unknown): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isInteger(n) || n < CARD_BACKGROUND_OPACITY_MIN || n > CARD_BACKGROUND_OPACITY_MAX) {
    return CARD_BACKGROUND_OPACITY_DEFAULT;
  }
  return n;
}

/**
 * Fundo a partir dos valores crus da configuração. Sem URL segura = sem fundo (null).
 * Fit e opacidade caem no padrão quando inválidos.
 */
export function parseMemberCardBackground(
  raw: { url?: unknown; fit?: unknown; opacity?: unknown } | null | undefined,
  cloudName: string | null | undefined,
): MemberCardBackground | null {
  const url = safeCardBackgroundUrl(raw?.url, cloudName);
  if (!url) return null;
  return {
    url,
    fit: normalizeCardBackgroundFit(raw?.fit),
    opacity: normalizeCardBackgroundOpacity(raw?.opacity),
  };
}

/** Entrada estrita da action de visual: campos extras são recusados (sem mass assignment). */
export const memberCardBackgroundInputSchema = z
  .object({
    /** "" remove o fundo. */
    url: z.string().max(URL_MAX_CHARS),
    fit: z.enum(CARD_BACKGROUND_FITS),
    opacity: z.number().int().min(CARD_BACKGROUND_OPACITY_MIN).max(CARD_BACKGROUND_OPACITY_MAX),
  })
  .strict();

/** Valor de UMA chave gravada por `updateConfigValues` (strings). Chaves fora do fundo: sempre válidas. */
export function isValidMemberCardConfigValue(
  key: string,
  value: string,
  cloudName: string | null | undefined,
): boolean {
  switch (key) {
    case "memberCardBackgroundUrl":
      return value === "" || safeCardBackgroundUrl(value, cloudName) !== null;
    case "memberCardBackgroundFit":
      return value === "" || (CARD_BACKGROUND_FITS as readonly string[]).includes(value);
    case "memberCardBackgroundOpacity":
      // Inteiro de 10 a 100, sem zero à esquerda nem sinal.
      return value === "" || /^(?:100|[1-9][0-9])$/.test(value);
    default:
      return true;
  }
}
