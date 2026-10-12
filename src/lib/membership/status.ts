/**
 * Regras de situação do sócio-torcedor (puras, sem I/O — fáceis de testar).
 *
 * - pending   → aguardando o 1º pagamento
 * - active    → em dia (inclui a carência de OVERDUE_GRACE_DAYS após vencer)
 * - suspended → mensalidade vencida há mais que a carência; volta a "active"
 *               sozinho quando o gateway confirma o pagamento
 * - cancelled → assinatura encerrada; benefícios valem até o fim do período
 *               já pago (nextBillingDate), salvo estorno/chargeback (imediato)
 */
export type MemberStatus = "pending" | "active" | "suspended" | "cancelled";

/** Dias de tolerância após o vencimento antes de suspender. */
export const OVERDUE_GRACE_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/** O sócio pode usar QR/desconto agora? */
export function memberHasBenefits(
  m: { status: string; nextBillingDate: Date | null },
  now: Date = new Date()
): boolean {
  if (m.status === "active") return true;
  if (m.status === "cancelled") return !!m.nextBillingDate && m.nextBillingDate.getTime() > now.getTime();
  return false;
}

/** Vencido há mais que a carência? (dueDate no formato AAAA-MM-DD do gateway) */
export function isPastGrace(dueDate: string | null, now: Date = new Date()): boolean {
  if (!dueDate) return false;
  // Vence no FIM do dia do vencimento (horário de Brasília, UTC-3).
  const due = new Date(`${dueDate}T23:59:59-03:00`);
  if (Number.isNaN(due.getTime())) return false;
  return now.getTime() - due.getTime() > OVERDUE_GRACE_DAYS * DAY_MS;
}

/** Data AAAA-MM-DD do gateway → Date (meio-dia de Brasília, evita virar o dia). */
export function parseGatewayDate(d: string | null | undefined): Date | null {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const date = new Date(`${d}T12:00:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
