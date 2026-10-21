/**
 * Regra genérica de RÓTULO de texto curto exibido na tela (nome do programa de sócio, nome
 * de seção da home). Módulo puro (sem I/O e sem "use server").
 *
 * Aceita só letras (com acento), marcas de acento, números, espaço, apóstrofo (reto e
 * tipográfico) e hífen. Nada de HTML, quebra de linha, emoji ou barra. Precisa ter ao menos
 * uma letra, sem espaço nas bordas e sem espaço duplo. O tamanho é em caracteres (code points).
 */

// Letras, marcas de acento (formas decompostas), números, espaço, apóstrofo e hífen.
const ALLOWED_CHARS_RE = /^[\p{L}\p{M}\p{N} '’-]+$/u;
const HAS_LETTER_RE = /\p{L}/u;

/** true se o valor é um rótulo válido com o tamanho dado. Vazio NÃO é válido (use o padrão). */
export function isValidLabelText(value: unknown, minChars: number, maxChars: number): boolean {
  if (typeof value !== "string") return false;
  const chars = Array.from(value).length;
  if (chars < minChars || chars > maxChars) return false;
  if (!ALLOWED_CHARS_RE.test(value)) return false;
  if (!HAS_LETTER_RE.test(value)) return false;
  if (value !== value.trim() || value.includes("  ")) return false;
  return true;
}
