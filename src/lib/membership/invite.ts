/**
 * "Indique um amigo" (member get member) do programa de sócio: só o convite, sem desconto,
 * recompensa ou rastreio de quem indicou.
 *
 * Módulo puro (sem I/O e sem "use server"): monta o link e o texto que o sócio compartilha.
 * O link é a página de adesão do próprio clube e NÃO leva nenhum dado do sócio (nada de
 * nome, e-mail, id ou código na URL). O texto leva só o nome do programa e do clube.
 */

import { resolveMembershipProgramName } from "@/lib/membership/program-name";

export const INVITE_PATH = "/socios/adesao";

/** Link do convite a partir da origem do site (ex.: https://clube.com.br). Origem inválida → só o caminho. */
export function inviteUrl(origin: string): string {
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:" && u.protocol !== "http:") return INVITE_PATH;
    return `${u.origin}${INVITE_PATH}`;
  } catch {
    return INVITE_PATH;
  }
}

/** Texto do convite (sem o link). Nome do clube vazio → texto sem o "do clube". */
export function inviteMessage(programName: unknown, clubName?: string | null): string {
  const program = resolveMembershipProgramName(programName);
  const club = clubName?.trim();
  return club
    ? `Vem ser ${program} do ${club} também! Conheça os planos:`
    : `Vem ser ${program} também! Conheça os planos:`;
}

/** Link do WhatsApp com o texto e o link do convite (o sócio escolhe o contato no app). */
export function inviteWhatsAppUrl(message: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`;
}
