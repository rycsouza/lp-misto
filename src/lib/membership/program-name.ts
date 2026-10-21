/**
 * Nome do programa de sócio de cada clube (ex.: "Sócio-Torcedor", "Sócio Torcedor VIP").
 * Chave `membershipProgramName` da configuração do clube. Vazio = usa o padrão.
 *
 * Módulo puro (sem I/O e sem "use server"): usado pela configuração (getSiteConfig), pela
 * action de gravação (updateConfigValues), pelas páginas, pela carteirinha, pelos e-mails,
 * pelo passe da Google Carteira e pelos componentes client (que recebem o valor por props).
 *
 * O nome aparece em texto de tela e de e-mail: por isso a regra aceita só letras (com
 * acento), números, espaço, hífen e apóstrofo. Nada de HTML, quebra de linha ou emoji.
 */

import { isValidLabelText } from "@/lib/label-rule";

export const MEMBERSHIP_PROGRAM_NAME_KEY = "membershipProgramName";
export const DEFAULT_MEMBERSHIP_PROGRAM_NAME = "Sócio-Torcedor";
export const MEMBERSHIP_PROGRAM_NAME_MIN_CHARS = 2;
export const MEMBERSHIP_PROGRAM_NAME_MAX_CHARS = 40;

/**
 * Nome válido para gravar: 2 a 40 caracteres, só os caracteres permitidos, ao menos uma
 * letra, sem espaço nas bordas e sem espaço duplo. Vazio NÃO é válido aqui (ver
 * isValidMembershipProgramNameConfigValue).
 */
export function isValidMembershipProgramName(value: string): boolean {
  // Regra compartilhada com os demais rótulos (src/lib/label-rule.ts): só o tamanho é próprio.
  return isValidLabelText(value, MEMBERSHIP_PROGRAM_NAME_MIN_CHARS, MEMBERSHIP_PROGRAM_NAME_MAX_CHARS);
}

/**
 * Valor de UMA chave de configuração gravada por `updateConfigValues`. Para a chave do
 * programa: vazio (volta ao padrão) ou nome válido. Outras chaves: sempre válidas aqui
 * (quem decide são as demais validações).
 */
export function isValidMembershipProgramNameConfigValue(key: string, value: string): boolean {
  if (key !== MEMBERSHIP_PROGRAM_NAME_KEY) return true;
  return value === "" || isValidMembershipProgramName(value);
}

/**
 * Nome a exibir, a partir de qualquer valor de origem (configuração, payload, cache).
 * Devolve o nome trimado se for válido; senão, o padrão. Nunca lança.
 */
export function resolveMembershipProgramName(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_MEMBERSHIP_PROGRAM_NAME;
  const name = raw.trim();
  return isValidMembershipProgramName(name) ? name : DEFAULT_MEMBERSHIP_PROGRAM_NAME;
}
