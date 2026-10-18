/**
 * Relatório financeiro do sócio-torcedor: agregações PURAS (sem banco).
 *
 * A action (src/app/actions/admin-membership-reports.ts) busca os totais já agrupados
 * no banco e passa para cá. Aqui fica a regra de negócio: o que é receita, MRR,
 * mês grátis, churn e custo dos benefícios.
 */
import { RECEIVED_LEDGER_STATUSES, type MembershipPaymentStatus } from "./ledger-status";

/** Pagamentos do período agrupados por plano e status (soma no banco). */
export interface PaymentAggRow {
  planId: string | null;
  planName: string | null;
  status: MembershipPaymentStatus;
  count: number;
  valueCents: number;
  /** Soma do líquido SÓ das linhas que têm líquido informado. */
  netValueCents: number;
  /** Quantas linhas do grupo têm líquido informado. */
  netKnownCount: number;
}

/** Sócios agrupados por plano, status e se estão em mês grátis (snapshot atual). */
export interface MemberAggRow {
  planId: string | null;
  planName: string | null;
  planPriceCents: number | null;
  status: "pending" | "active" | "suspended" | "cancelled";
  inTrial: boolean;
  count: number;
}

export interface PeriodMemberCounts {
  newMembers: number;
  cancelledMembers: number;
}

export interface MemberBenefitTotals {
  /** Pedidos pagos com desconto de sócio no período. */
  memberDiscountOrders: number;
  /** Desconto concedido (valor positivo em centavos). */
  memberDiscountCents: number;
  /** Ingressos grátis do plano resgatados no período. */
  freeTicketsRedeemed: number;
}

export interface OverdueTotals {
  /** Mensalidades vencidas registradas no ledger (de sócios suspensos). */
  count: number;
  valueCents: number;
}

export interface MembershipReportInput {
  payments: PaymentAggRow[];
  members: MemberAggRow[];
  period: PeriodMemberCounts;
  benefits: MemberBenefitTotals;
  overdue: OverdueTotals;
}

export interface MembershipPlanReportRow {
  planId: string | null;
  planName: string;
  activePaying: number;
  inTrial: number;
  receivedCount: number;
  receivedGrossCents: number;
  receivedNetCents: number;
  mrrCents: number;
}

export interface MembershipReport {
  receivedCount: number;
  receivedGrossCents: number;
  /** Líquido: soma só dos pagamentos com taxa informada. */
  receivedNetCents: number;
  /** Pagamentos recebidos sem líquido informado pelo gateway. */
  receivedWithoutNetCount: number;
  refundedCount: number;
  refundedCents: number;
  chargebackCount: number;
  chargebackCents: number;
  /** Ticket médio do período: bruto recebido ÷ pagamentos recebidos. */
  avgTicketCents: number;

  /** MRR pagante: soma do preço do plano dos sócios ativos fora do mês grátis. */
  mrrCents: number;
  /** Sócios ativos pagantes (fora do mês grátis). */
  payingMembers: number;
  /** Ticket médio por sócio pagante: MRR ÷ pagantes. */
  avgMemberMrrCents: number;
  /** Previsto quando o mês grátis acabar (sócios ativos ainda em mês grátis). */
  trialMrrCents: number;
  trialMembers: number;

  activeMembers: number;
  suspendedMembers: number;
  pendingMembers: number;
  cancelledMembers: number;
  /** Estimativa: 1 mensalidade (preço do plano) por sócio suspenso. */
  suspendedEstimatedCents: number;
  overdueLedgerCount: number;
  overdueLedgerCents: number;

  newMembers: number;
  cancelledInPeriod: number;
  /** Churn do período (%), com base aproximada. NULL quando a base é zero. */
  churnPct: number | null;

  memberDiscountOrders: number;
  memberDiscountCents: number;
  freeTicketsRedeemed: number;

  plans: MembershipPlanReportRow[];
}

/** Churn (%) = cancelamentos ÷ base inicial × 100, com 1 casa decimal. */
export function computeChurnPct(cancelled: number, base: number): number | null {
  if (base <= 0) return null;
  return Math.round((cancelled / base) * 1000) / 10;
}

/** Base inicial aproximada do período: ativos+suspensos agora + cancelados no período − novos no período. */
export function computeStartBase(activeOrSuspendedNow: number, period: PeriodMemberCounts): number {
  return Math.max(0, activeOrSuspendedNow + period.cancelledMembers - period.newMembers);
}

/** Soma de `value` sobre as linhas que passam em `pick` (padrão: todas). */
function sumIf<T>(rows: readonly T[], pick: (r: T) => boolean, value: (r: T) => number): number {
  let total = 0;
  for (const r of rows) if (pick(r)) total += value(r);
  return total;
}
const sumAll = <T>(rows: readonly T[], value: (r: T) => number): number => sumIf(rows, () => true, value);

export function buildMembershipReport(input: MembershipReportInput): MembershipReport {
  const { payments, members, period, benefits, overdue } = input;

  // Recebidos: confirmados e recebidos. Estorno/chargeback são contados à parte.
  const received = payments.filter((p) => RECEIVED_LEDGER_STATUSES.includes(p.status));
  const receivedCount = sumAll(received, (p) => p.count);
  const receivedGrossCents = sumAll(received, (p) => p.valueCents);
  const receivedNetCents = sumAll(received, (p) => p.netValueCents);
  const receivedWithoutNetCount = sumAll(received, (p) => p.count - p.netKnownCount);

  const refunded = payments.filter((p) => p.status === "refunded");
  const chargeback = payments.filter((p) => p.status === "chargeback");

  // Sócios: snapshot atual. Mês grátis só conta quem ainda não pagou.
  const isPaying = (m: MemberAggRow) => m.status === "active" && !m.inTrial;
  const isTrial = (m: MemberAggRow) => m.status === "active" && m.inTrial;
  const payingMembers = sumIf(members, isPaying, (m) => m.count);
  const mrrCents = sumIf(members, isPaying, (m) => m.count * (m.planPriceCents ?? 0));
  const trialMembers = sumIf(members, isTrial, (m) => m.count);
  const trialMrrCents = sumIf(members, isTrial, (m) => m.count * (m.planPriceCents ?? 0));
  const activeMembers = sumIf(members, (m) => m.status === "active", (m) => m.count);
  const suspendedMembers = sumIf(members, (m) => m.status === "suspended", (m) => m.count);
  const pendingMembers = sumIf(members, (m) => m.status === "pending", (m) => m.count);
  const cancelledMembers = sumIf(members, (m) => m.status === "cancelled", (m) => m.count);
  const suspendedEstimatedCents = sumIf(
    members,
    (m) => m.status === "suspended",
    (m) => m.count * (m.planPriceCents ?? 0)
  );

  const churnPct = computeChurnPct(
    period.cancelledMembers,
    computeStartBase(activeMembers + suspendedMembers, period)
  );

  // Por plano: junta as linhas de sócios e de pagamentos pelo plano (ou "sem plano").
  const planMap = new Map<string, MembershipPlanReportRow>();
  const keyOf = (planId: string | null) => planId ?? "__sem_plano__";
  const ensure = (planId: string | null, planName: string | null) => {
    const key = keyOf(planId);
    let row = planMap.get(key);
    if (!row) {
      row = {
        planId,
        planName: planName ?? (planId ? "Plano removido" : "Sem plano"),
        activePaying: 0,
        inTrial: 0,
        receivedCount: 0,
        receivedGrossCents: 0,
        receivedNetCents: 0,
        mrrCents: 0,
      };
      planMap.set(key, row);
    }
    return row;
  };
  for (const m of members) {
    if (m.status !== "active") continue;
    const row = ensure(m.planId, m.planName);
    if (m.inTrial) row.inTrial += m.count;
    else {
      row.activePaying += m.count;
      row.mrrCents += m.count * (m.planPriceCents ?? 0);
    }
  }
  for (const p of received) {
    const row = ensure(p.planId, p.planName);
    row.receivedCount += p.count;
    row.receivedGrossCents += p.valueCents;
    row.receivedNetCents += p.netValueCents;
  }
  const plans = [...planMap.values()].sort(
    (a, b) => b.receivedGrossCents - a.receivedGrossCents || b.mrrCents - a.mrrCents || a.planName.localeCompare(b.planName, "pt-BR")
  );

  return {
    receivedCount,
    receivedGrossCents,
    receivedNetCents,
    receivedWithoutNetCount,
    refundedCount: sumAll(refunded, (p) => p.count),
    refundedCents: sumAll(refunded, (p) => p.valueCents),
    chargebackCount: sumAll(chargeback, (p) => p.count),
    chargebackCents: sumAll(chargeback, (p) => p.valueCents),
    avgTicketCents: receivedCount > 0 ? Math.round(receivedGrossCents / receivedCount) : 0,

    mrrCents,
    payingMembers,
    avgMemberMrrCents: payingMembers > 0 ? Math.round(mrrCents / payingMembers) : 0,
    trialMrrCents,
    trialMembers,

    activeMembers,
    suspendedMembers,
    pendingMembers,
    cancelledMembers,
    suspendedEstimatedCents,
    overdueLedgerCount: overdue.count,
    overdueLedgerCents: overdue.valueCents,

    newMembers: period.newMembers,
    cancelledInPeriod: period.cancelledMembers,
    churnPct,

    memberDiscountOrders: benefits.memberDiscountOrders,
    memberDiscountCents: benefits.memberDiscountCents,
    freeTicketsRedeemed: benefits.freeTicketsRedeemed,

    plans,
  };
}

function brl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/**
 * Linhas do CSV do relatório (agregado: nenhum dado pessoal). Valores em texto
 * formatado (R$ e %) ou número inteiro; a neutralização de fórmula é feita por
 * toCsv (src/lib/admin/csv.ts), que recebe estas células.
 */
export function buildMembershipReportCsvRows(
  r: MembershipReport & { range: { from: string; to: string } }
): (string | number)[][] {
  const pct = r.churnPct == null ? "" : `${r.churnPct.toFixed(1).replace(".", ",")}%`;
  const rows: (string | number)[][] = [
    ["Sócio-torcedor: relatório", `${r.range.from} a ${r.range.to}`],
    [],
    ["Indicador", "Valor"],
    ["Receita recebida (bruta)", brl(r.receivedGrossCents)],
    ["Receita recebida (líquida)", brl(r.receivedNetCents)],
    ["Pagamentos recebidos", r.receivedCount],
    ["Pagamentos sem líquido informado pelo gateway", r.receivedWithoutNetCount],
    ["Ticket médio do período", brl(r.avgTicketCents)],
    ["Estornos (quantidade)", r.refundedCount],
    ["Estornos (valor)", brl(r.refundedCents)],
    ["Chargebacks (quantidade)", r.chargebackCount],
    ["Chargebacks (valor)", brl(r.chargebackCents)],
    ["MRR pagante", brl(r.mrrCents)],
    ["Sócios pagantes", r.payingMembers],
    ["Ticket médio por sócio pagante", brl(r.avgMemberMrrCents)],
    ["Sócios em mês grátis", r.trialMembers],
    ["MRR previsto do mês grátis", brl(r.trialMrrCents)],
    ["Sócios ativos", r.activeMembers],
    ["Sócios suspensos", r.suspendedMembers],
    ["Valor em aberto estimado (suspensos)", brl(r.suspendedEstimatedCents)],
    ["Mensalidades vencidas registradas", r.overdueLedgerCount],
    ["Valor vencido registrado", brl(r.overdueLedgerCents)],
    ["Sócios pendentes", r.pendingMembers],
    ["Sócios cancelados", r.cancelledMembers],
    ["Novas adesões no período", r.newMembers],
    ["Cancelamentos no período", r.cancelledInPeriod],
    ["Churn do período", pct],
    ["Pedidos com desconto de sócio", r.memberDiscountOrders],
    ["Desconto de sócio concedido", brl(r.memberDiscountCents)],
    ["Ingressos grátis resgatados", r.freeTicketsRedeemed],
    [],
    ["Plano", "Sócios pagantes", "Em mês grátis", "Pagamentos recebidos", "Receita bruta", "Receita líquida", "MRR"],
  ];
  for (const p of r.plans) {
    rows.push([
      p.planName,
      p.activePaying,
      p.inTrial,
      p.receivedCount,
      brl(p.receivedGrossCents),
      brl(p.receivedNetCents),
      brl(p.mrrCents),
    ]);
  }
  return rows;
}
