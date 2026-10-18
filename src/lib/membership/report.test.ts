import { describe, it, expect } from "vitest";
import {
  buildMembershipReport,
  buildMembershipReportCsvRows,
  computeChurnPct,
  computeStartBase,
  type MemberAggRow,
  type PaymentAggRow,
} from "./report";
import { toCsv } from "@/lib/admin/csv";

const OURO = "11111111-1111-4111-8111-111111111111";
const PRATA = "22222222-2222-4222-8222-222222222222";

// Fixture: pagamentos do período (por plano e status).
const payments: PaymentAggRow[] = [
  { planId: OURO, planName: "Ouro", status: "confirmed", count: 2, valueCents: 20000, netValueCents: 19000, netKnownCount: 1 },
  { planId: OURO, planName: "Ouro", status: "received", count: 1, valueCents: 10000, netValueCents: 9500, netKnownCount: 1 },
  { planId: PRATA, planName: "Prata", status: "refunded", count: 1, valueCents: 5000, netValueCents: 0, netKnownCount: 0 },
  { planId: null, planName: null, status: "chargeback", count: 1, valueCents: 3000, netValueCents: 0, netKnownCount: 0 },
  { planId: PRATA, planName: "Prata", status: "received", count: 1, valueCents: 5000, netValueCents: 4800, netKnownCount: 1 },
];

// Fixture: sócios agora (snapshot).
const members: MemberAggRow[] = [
  { planId: OURO, planName: "Ouro", planPriceCents: 10000, status: "active", inTrial: false, count: 5 },
  { planId: OURO, planName: "Ouro", planPriceCents: 10000, status: "active", inTrial: true, count: 2 },
  { planId: PRATA, planName: "Prata", planPriceCents: 4000, status: "active", inTrial: false, count: 3 },
  { planId: PRATA, planName: "Prata", planPriceCents: 4000, status: "suspended", inTrial: false, count: 2 },
  { planId: null, planName: null, planPriceCents: null, status: "pending", inTrial: false, count: 1 },
  { planId: OURO, planName: "Ouro", planPriceCents: 10000, status: "cancelled", inTrial: false, count: 1 },
];

const base = {
  payments,
  members,
  period: { newMembers: 4, cancelledMembers: 2 },
  benefits: { memberDiscountOrders: 3, memberDiscountCents: 4500, freeTicketsRedeemed: 2 },
  overdue: { count: 1, valueCents: 4000 },
};

describe("receita do período", () => {
  const r = buildMembershipReport(base);

  it("soma a receita bruta só de pagamentos recebidos (confirmados e recebidos)", () => {
    expect(r.receivedCount).toBe(4);
    expect(r.receivedGrossCents).toBe(35000);
  });

  it("líquido soma só o que o gateway informou; o resto é contado à parte", () => {
    expect(r.receivedNetCents).toBe(33300);
    expect(r.receivedWithoutNetCount).toBe(1);
  });

  it("estorno e chargeback NÃO entram na receita, saem em linha própria", () => {
    expect(r.refundedCount).toBe(1);
    expect(r.refundedCents).toBe(5000);
    expect(r.chargebackCount).toBe(1);
    expect(r.chargebackCents).toBe(3000);
  });

  it("ticket médio = bruto recebido ÷ pagamentos recebidos", () => {
    expect(r.avgTicketCents).toBe(8750);
  });
});

describe("MRR, mês grátis e sócios", () => {
  const r = buildMembershipReport(base);

  it("MRR pagante: só ativos fora do mês grátis (sem suspensos, pendentes nem cancelados)", () => {
    // Ouro 5 × 10.000 + Prata 3 × 4.000
    expect(r.mrrCents).toBe(62000);
    expect(r.payingMembers).toBe(8);
    expect(r.avgMemberMrrCents).toBe(7750);
  });

  it("mês grátis fica FORA do MRR e aparece como previsto à parte", () => {
    expect(r.trialMembers).toBe(2);
    expect(r.trialMrrCents).toBe(20000);
  });

  it("contagens por situação", () => {
    expect(r.activeMembers).toBe(10);
    expect(r.suspendedMembers).toBe(2);
    expect(r.pendingMembers).toBe(1);
    expect(r.cancelledMembers).toBe(1);
  });

  it("valor em aberto estimado: 1 mensalidade por sócio suspenso; vencidos do ledger à parte", () => {
    expect(r.suspendedEstimatedCents).toBe(8000);
    expect(r.overdueLedgerCount).toBe(1);
    expect(r.overdueLedgerCents).toBe(4000);
  });

  it("ativo sem plano (preço ausente) não infla o MRR", () => {
    const r2 = buildMembershipReport({
      ...base,
      members: [{ planId: null, planName: null, planPriceCents: null, status: "active", inTrial: false, count: 4 }],
    });
    expect(r2.mrrCents).toBe(0);
    expect(r2.payingMembers).toBe(4);
  });
});

describe("adesões, cancelamentos e churn", () => {
  it("base inicial aproximada = ativos+suspensos agora + cancelados no período − novos no período", () => {
    expect(computeStartBase(12, { newMembers: 4, cancelledMembers: 2 })).toBe(10);
    expect(computeStartBase(1, { newMembers: 10, cancelledMembers: 0 })).toBe(0);
  });

  it("churn % = cancelamentos ÷ base, com 1 casa decimal", () => {
    const r = buildMembershipReport(base);
    // ativos+suspensos = 12; base = 12 + 2 − 4 = 10; churn = 2 ÷ 10 = 20%
    expect(r.churnPct).toBe(20);
    expect(r.newMembers).toBe(4);
    expect(r.cancelledInPeriod).toBe(2);
  });

  it("churn sem base (zero) é null, não divisão por zero", () => {
    expect(computeChurnPct(3, 0)).toBeNull();
    expect(computeChurnPct(1, 3)).toBe(33.3);
  });
});

describe("custo dos benefícios", () => {
  it("repassa descontos e ingressos grátis do período", () => {
    const r = buildMembershipReport(base);
    expect(r.memberDiscountOrders).toBe(3);
    expect(r.memberDiscountCents).toBe(4500);
    expect(r.freeTicketsRedeemed).toBe(2);
  });
});

describe("por plano", () => {
  it("junta sócios e recebimentos por plano, ordena pela receita bruta e marca plano removido", () => {
    const r = buildMembershipReport(base);
    expect(r.plans.map((p) => p.planName)).toEqual(["Ouro", "Prata"]);
    const ouro = r.plans[0];
    expect(ouro).toMatchObject({
      activePaying: 5,
      inTrial: 2,
      receivedCount: 3,
      receivedGrossCents: 30000,
      receivedNetCents: 28500,
      mrrCents: 50000,
    });
    const prata = r.plans[1];
    expect(prata).toMatchObject({ activePaying: 3, receivedCount: 1, receivedGrossCents: 5000, mrrCents: 12000 });
  });

  it("pagamento de plano apagado aparece como 'Plano removido'", () => {
    const r = buildMembershipReport({
      ...base,
      payments: [
        { planId: "33333333-3333-4333-8333-333333333333", planName: null, status: "received", count: 1, valueCents: 700, netValueCents: 0, netKnownCount: 0 },
      ],
      members: [],
    });
    expect(r.plans[0].planName).toBe("Plano removido");
  });
});

describe("período vazio", () => {
  it("tudo zerado, sem NaN e sem divisão por zero", () => {
    const r = buildMembershipReport({
      payments: [],
      members: [],
      period: { newMembers: 0, cancelledMembers: 0 },
      benefits: { memberDiscountOrders: 0, memberDiscountCents: 0, freeTicketsRedeemed: 0 },
      overdue: { count: 0, valueCents: 0 },
    });
    expect(r.avgTicketCents).toBe(0);
    expect(r.avgMemberMrrCents).toBe(0);
    expect(r.churnPct).toBeNull();
    expect(r.plans).toEqual([]);
    expect(Object.values(r).every((v) => !(typeof v === "number" && Number.isNaN(v)))).toBe(true);
  });
});

describe("CSV do relatório", () => {
  const view = { ...buildMembershipReport(base), range: { from: "2026-10-01", to: "2026-10-17" } };

  it("gera o cabeçalho do período, os indicadores e a tabela por plano", () => {
    const text = toCsv(buildMembershipReportCsvRows(view));
    expect(text).toContain('"Sócio-torcedor: relatório","2026-10-01 a 2026-10-17"');
    expect(text).toContain('"Churn do período","20,0%"');
    expect(text).toContain('"Plano","Sócios pagantes","Em mês grátis"');
    expect(text).toContain('"Ouro",5,2,3,');
  });

  it("nome de plano com fórmula é neutralizado no CSV (injeção de fórmula)", () => {
    const evil = buildMembershipReport({
      ...base,
      payments: [],
      members: [{ planId: OURO, planName: '=HYPERLINK("http://x","clique")', planPriceCents: 100, status: "active", inTrial: false, count: 1 }],
    });
    const text = toCsv(buildMembershipReportCsvRows({ ...evil, range: { from: "2026-10-01", to: "2026-10-01" } }));
    expect(text).toContain(`"'=HYPERLINK(""http://x"",""clique"")"`);
    expect(text).not.toMatch(/(^|\n)"?=HYPERLINK/);
  });
});
