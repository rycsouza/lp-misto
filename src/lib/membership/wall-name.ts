import { z } from "zod";

/**
 * Nome no Mural dos Sócios (opt-in, LGPD). O nome que aparece é sempre o nome do
 * cadastro (conta ou adesão), nunca texto livre; só ele vai ao público: nunca
 * e-mail, telefone, CPF ou qualquer outro dado. Módulo puro (sem I/O), usado pelo
 * servidor (zod) e pelo formulário.
 *
 * Regras: trim e espaços colapsados; 2–40 caracteres; só letras (com acentos),
 * números, espaço, ponto, hífen e apóstrofo. Sem HTML, emoji, URL ou pontuação
 * encadeada. O React já escapa a saída; esta validação é a barreira de conteúdo.
 */

const WALL_NAME_MIN = 2;
const WALL_NAME_MAX = 40;

const ALLOWED = /^[\p{L}\p{Nd} .'’-]+$/u;
const URL_LIKE = /https?|www/i;

/** Trim, espaços colapsados e forma NFC (o que é gravado). */
export function normalizeWallName(raw: string): string {
  return raw.normalize("NFC").trim().replace(/\s+/g, " ");
}

/** Motivo da recusa em português, ou null se o nome é aceito. */
export function wallNameProblem(raw: string): string | null {
  const name = normalizeWallName(raw);
  const len = [...name].length;
  if (len < WALL_NAME_MIN || len > WALL_NAME_MAX) {
    return `Use entre ${WALL_NAME_MIN} e ${WALL_NAME_MAX} caracteres.`;
  }
  if (!ALLOWED.test(name)) return "Use só letras, números, espaço, ponto, hífen ou apóstrofo.";
  // Ponto colado em outro caractere (ex.: "ana.com", "J.P") e endereços: recusados.
  if (URL_LIKE.test(name) || /\.\S/.test(name)) return "Não use links nem endereços no nome.";
  if (!/^\p{L}/u.test(name) || !/[\p{L}\p{Nd}.]$/u.test(name)) {
    return "O nome deve começar com letra e não pode terminar com hífen ou apóstrofo.";
  }
  if (/[.\-'’]{2,}/.test(name)) return "Pontuação repetida no nome.";
  return null;
}

/** Schema zod: aceita o texto cru e devolve o nome normalizado, ou recusa com a mensagem. */
export const wallNameSchema = z
  .string()
  .max(200, "Nome muito longo.")
  .superRefine((raw, ctx) => {
    const problem = wallNameProblem(raw);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  })
  .transform(normalizeWallName);

/**
 * Nome exibido no mural: primeiro nome completo + inicial do último sobrenome
 * ("Maria da Silva" → "Maria S."). Encurtado AQUI, no servidor: o nome completo
 * nunca vai para a página pública. Nome de uma palavra só fica como está.
 */
export function wallDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0];
  if (parts.length === 1) return first;
  const initial = parts[parts.length - 1].charAt(0).toLocaleUpperCase("pt-BR");
  return `${first} ${initial}.`;
}
