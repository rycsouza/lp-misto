/**
 * Ledger de mensalidades: normalização PURA (sem banco nem gateway).
 *
 * Converte o status bruto do gateway (Asaas) para o vocabulário do ledger e valida
 * os valores vindos do gateway antes de gravar. Status desconhecido NÃO é gravado
 * (retorna null): melhor a linha faltar do que entrar com um status errado.
 */
import type { MembershipPaymentStatusValue } from "@/lib/db/schema/membership";
import { parseGatewayDate } from "./status";

export type MembershipPaymentStatus = MembershipPaymentStatusValue;

const GATEWAY_STATUS: Readonly<Record<string, MembershipPaymentStatus>> = {
  PENDING: "pending",
  AWAITING_RISK_ANALYSIS: "pending",
  CONFIRMED: "confirmed",
  RECEIVED: "received",
  RECEIVED_IN_CASH: "received",
  DUNNING_RECEIVED: "received",
  OVERDUE: "overdue",
  DUNNING_REQUESTED: "overdue",
  // Estorno pedido ou em andamento ainda não é receita: entra como "refunded".
  REFUND_REQUESTED: "refunded",
  REFUND_IN_PROGRESS: "refunded",
  REFUNDED: "refunded",
  CHARGEBACK_REQUESTED: "chargeback",
  CHARGEBACK_DISPUTE: "chargeback",
  AWAITING_CHARGEBACK_REVERSAL: "chargeback",
  DELETED: "cancelled",
};

/** Status que contam como receita recebida. */
export const RECEIVED_LEDGER_STATUSES: readonly MembershipPaymentStatus[] = ["confirmed", "received"];

/** Status normalizado, ou null para status que o sistema não conhece. */
export function normalizeGatewayPaymentStatus(raw: unknown): MembershipPaymentStatus | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(GATEWAY_STATUS, key) ? GATEWAY_STATUS[key] : null;
}

/** Entrada já lida do gateway (nunca do corpo do webhook). */
export interface GatewayPaymentRecord {
  id: string | null;
  valueCents: number;
  netValueCents: number | null;
  status: string;
  dueDate: string | null;
  paymentDate: string | null;
  billingType: string | null;
}

export interface LedgerPaymentRow {
  gatewayPaymentId: string;
  valueCents: number;
  netValueCents: number | null;
  status: MembershipPaymentStatus;
  dueDate: string | null;
  paidAt: Date | null;
  billingType: string | null;
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
// Teto de sanidade (R$ 10 milhões) — dentro do `integer` do Postgres (até ~R$ 21 milhões).
const MAX_CENTS = 1_000_000_000;

function validCents(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_CENTS;
}

/**
 * Monta a linha do ledger a partir do registro do gateway. Retorna null (pular a
 * linha) quando o id não existe, o valor é inválido ou o status é desconhecido.
 * `paid_at` vem da data de pagamento do gateway; sem ela, cobrança paga usa o
 * vencimento como aproximação.
 */
export function toLedgerRow(rec: GatewayPaymentRecord): LedgerPaymentRow | null {
  if (typeof rec.id !== "string" || rec.id.length === 0 || rec.id.length > 100) return null;
  if (!validCents(rec.valueCents)) return null;
  const status = normalizeGatewayPaymentStatus(rec.status);
  if (!status) return null;

  const net = rec.netValueCents;
  const netValueCents = validCents(net) ? net : null;
  const dueDate = rec.dueDate && DATE_ONLY_RE.test(rec.dueDate) ? rec.dueDate : null;

  let paidAt: Date | null = null;
  const paidDay = rec.paymentDate && DATE_ONLY_RE.test(rec.paymentDate) ? rec.paymentDate : null;
  if (paidDay) {
    paidAt = parseGatewayDate(paidDay);
  } else if (RECEIVED_LEDGER_STATUSES.includes(status) && dueDate) {
    paidAt = parseGatewayDate(dueDate);
  }

  return {
    gatewayPaymentId: rec.id,
    valueCents: rec.valueCents,
    netValueCents,
    status,
    dueDate,
    paidAt,
    billingType: typeof rec.billingType === "string" && rec.billingType ? rec.billingType.slice(0, 40) : null,
  };
}
