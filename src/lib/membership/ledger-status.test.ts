import { describe, it, expect } from "vitest";
import { normalizeGatewayPaymentStatus, toLedgerRow, type GatewayPaymentRecord } from "./ledger-status";

const base: GatewayPaymentRecord = {
  id: "pay_1",
  valueCents: 9990,
  netValueCents: null,
  status: "RECEIVED",
  dueDate: "2026-09-10",
  paymentDate: "2026-09-10",
  billingType: "CREDIT_CARD",
};

describe("normalizeGatewayPaymentStatus", () => {
  it.each([
    ["PENDING", "pending"],
    ["AWAITING_RISK_ANALYSIS", "pending"],
    ["CONFIRMED", "confirmed"],
    ["RECEIVED", "received"],
    ["RECEIVED_IN_CASH", "received"],
    ["DUNNING_RECEIVED", "received"],
    ["OVERDUE", "overdue"],
    ["DUNNING_REQUESTED", "overdue"],
    ["REFUNDED", "refunded"],
    ["REFUND_REQUESTED", "refunded"],
    ["REFUND_IN_PROGRESS", "refunded"],
    ["CHARGEBACK_REQUESTED", "chargeback"],
    ["CHARGEBACK_DISPUTE", "chargeback"],
    ["AWAITING_CHARGEBACK_REVERSAL", "chargeback"],
    ["DELETED", "cancelled"],
  ])("%s vira %s", (raw, expected) => {
    expect(normalizeGatewayPaymentStatus(raw)).toBe(expected);
  });

  it("ignora caixa e espaços", () => {
    expect(normalizeGatewayPaymentStatus("  received ")).toBe("received");
  });

  it("status desconhecido, vazio ou não-texto → null (não grava)", () => {
    expect(normalizeGatewayPaymentStatus("NOVO_STATUS_DO_GATEWAY")).toBeNull();
    expect(normalizeGatewayPaymentStatus("")).toBeNull();
    expect(normalizeGatewayPaymentStatus(undefined)).toBeNull();
    expect(normalizeGatewayPaymentStatus(42)).toBeNull();
  });

  it("não aceita chaves herdadas do objeto (ex.: constructor)", () => {
    expect(normalizeGatewayPaymentStatus("constructor")).toBeNull();
    expect(normalizeGatewayPaymentStatus("__proto__")).toBeNull();
  });
});

describe("toLedgerRow", () => {
  it("monta a linha com os valores do gateway", () => {
    const row = toLedgerRow({ ...base, netValueCents: 9500 });
    expect(row).toEqual({
      gatewayPaymentId: "pay_1",
      valueCents: 9990,
      netValueCents: 9500,
      status: "received",
      dueDate: "2026-09-10",
      paidAt: new Date("2026-09-10T12:00:00-03:00"),
      billingType: "CREDIT_CARD",
    });
  });

  it("líquido ausente no gateway → null (não inventa)", () => {
    expect(toLedgerRow({ ...base, netValueCents: null })?.netValueCents).toBeNull();
  });

  it("cobrança paga sem data de pagamento usa o vencimento como aproximação", () => {
    const row = toLedgerRow({ ...base, paymentDate: null });
    expect(row?.paidAt).toEqual(new Date("2026-09-10T12:00:00-03:00"));
  });

  it("cobrança pendente sem data de pagamento fica sem paid_at", () => {
    const row = toLedgerRow({ ...base, status: "PENDING", paymentDate: null });
    expect(row).toMatchObject({ status: "pending", paidAt: null });
  });

  it("estorno mantém a data em que o dinheiro entrou (paymentDate)", () => {
    const row = toLedgerRow({ ...base, status: "REFUNDED" });
    expect(row).toMatchObject({ status: "refunded", paidAt: new Date("2026-09-10T12:00:00-03:00") });
  });

  it("rejeita id ausente, vazio ou longo demais", () => {
    expect(toLedgerRow({ ...base, id: null })).toBeNull();
    expect(toLedgerRow({ ...base, id: "" })).toBeNull();
    expect(toLedgerRow({ ...base, id: "x".repeat(101) })).toBeNull();
  });

  it("rejeita valor inválido (negativo, fracionado, NaN, acima do teto)", () => {
    expect(toLedgerRow({ ...base, valueCents: -1 })).toBeNull();
    expect(toLedgerRow({ ...base, valueCents: 10.5 })).toBeNull();
    expect(toLedgerRow({ ...base, valueCents: Number.NaN })).toBeNull();
    expect(toLedgerRow({ ...base, valueCents: 2_000_000_000 })).toBeNull();
  });

  it("líquido inválido vira null sem derrubar a linha", () => {
    expect(toLedgerRow({ ...base, netValueCents: -5 })?.netValueCents).toBeNull();
  });

  it("status desconhecido → linha não é montada", () => {
    expect(toLedgerRow({ ...base, status: "INVENTADO" })).toBeNull();
  });

  it("data mal formatada vira null (não chega ao banco)", () => {
    const row = toLedgerRow({ ...base, dueDate: "10/09/2026", paymentDate: "2026-02-31x" });
    expect(row?.dueDate).toBeNull();
    expect(row?.paidAt).toBeNull();
  });
});
