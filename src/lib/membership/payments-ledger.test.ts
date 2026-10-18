import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Ledger de mensalidades: os valores vêm SEMPRE do gateway (reconsulta), a gravação
 * é upsert por gateway_payment_id (idempotente) e uma falha de um sócio não derruba
 * o lote. O banco é simulado: o upsert é modelado pelo id da cobrança.
 */
type GwPayment = {
  gatewayPaymentId: string;
  valueCents: number;
  netValueCents: number | null;
  status: string;
  dueDate: string | null;
  paymentDate: string | null;
  billingType: string | null;
  invoiceUrl: string | null;
};

const h = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  inserts: [] as { rows: Record<string, unknown>[]; target: unknown; set: Record<string, unknown> }[],
  memberUpdates: [] as Record<string, unknown>[],
  gateway: null as null | {
    slug: string;
    gateway: { listSubscriptionPayments?: (id: string) => Promise<unknown[]> };
  },
  gatewayCalls: [] as string[],
}));

function selectChain(result: unknown[]): unknown {
  const chain: Record<string, unknown> = {
    from: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

vi.mock("@/lib/db/client", () => ({
  getDb: async () => ({
    select: () => selectChain(h.selectResults.shift() ?? []),
    insert: () => ({
      values: (rows: Record<string, unknown>[]) => ({
        onConflictDoUpdate: (cfg: { target: unknown; set: Record<string, unknown> }) => {
          h.inserts.push({ rows, target: cfg.target, set: cfg.set });
          return Promise.resolve();
        },
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          h.memberUpdates.push(values);
          return Promise.resolve();
        },
      }),
    }),
  }),
}));

vi.mock("@/lib/payment/subscription-factory", () => ({
  getSubscriptionGateway: async () => h.gateway,
}));

import { membershipPayments } from "@/lib/db/schema";
import {
  importMembershipPaymentsBatch,
  recordRecentMembershipPayments,
  recordSubscriptionPayments,
} from "./payments-ledger";

const MEMBER = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const PLAN = "1c6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";

function payment(over: Partial<GwPayment> = {}): GwPayment {
  return {
    gatewayPaymentId: "pay_1",
    valueCents: 9990,
    netValueCents: 9500,
    status: "RECEIVED",
    dueDate: "2026-09-10",
    paymentDate: "2026-09-10",
    billingType: "CREDIT_CARD",
    invoiceUrl: null,
    ...over,
  };
}

/** Simula a tabela: o upsert por gateway_payment_id substitui a linha existente. */
function applyUpserts(): Map<string, Record<string, unknown>> {
  const store = new Map<string, Record<string, unknown>>();
  for (const ins of h.inserts) {
    for (const row of ins.rows) store.set(row.gatewayPaymentId as string, row);
  }
  return store;
}

beforeEach(() => {
  h.selectResults = [];
  h.inserts = [];
  h.memberUpdates = [];
  h.gatewayCalls = [];
  h.gateway = {
    slug: "asaas",
    gateway: {
      listSubscriptionPayments: async (id: string) => {
        h.gatewayCalls.push(id);
        return [payment()];
      },
    },
  };
});

describe("recordSubscriptionPayments", () => {
  it("upsert é idempotente: a mesma cobrança gravada 2x vira uma linha", async () => {
    h.selectResults = [[{ id: MEMBER, planId: PLAN }], [{ id: MEMBER, planId: PLAN }]];
    await recordSubscriptionPayments("sub_1");
    await recordSubscriptionPayments("sub_1");

    expect(h.inserts).toHaveLength(2);
    expect(h.inserts[0].target).toBe(membershipPayments.gatewayPaymentId);
    expect(applyUpserts().size).toBe(1);
  });

  it("o conflito atualiza status, valores e data de pagamento, mas não troca o plano", async () => {
    h.selectResults = [[{ id: MEMBER, planId: PLAN }]];
    await recordSubscriptionPayments("sub_1");
    const set = h.inserts[0].set;
    expect(Object.keys(set)).toEqual(
      expect.arrayContaining(["status", "valueCents", "netValueCents", "paidAt", "updatedAt"])
    );
    expect(set).not.toHaveProperty("planId");
    expect(set).not.toHaveProperty("memberId");
    // paid_at usa coalesce(excluded, atual): estorno não apaga a data já gravada.
    // Esse SQL só roda de verdade no Postgres (ver relatório: validar no banco de teste).
    expect(set.paidAt).toBeDefined();
  });

  it("grava valor, líquido e status vindos do GATEWAY", async () => {
    h.selectResults = [[{ id: MEMBER, planId: PLAN }]];
    h.gateway!.gateway.listSubscriptionPayments = async () => [
      payment({ valueCents: 12345, netValueCents: 11900, status: "CONFIRMED", paymentDate: null }),
    ];
    await recordSubscriptionPayments("sub_1");
    expect(h.inserts[0].rows[0]).toMatchObject({
      memberId: MEMBER,
      planId: PLAN,
      gatewaySlug: "asaas",
      subscriptionId: "sub_1",
      gatewayPaymentId: "pay_1",
      valueCents: 12345,
      netValueCents: 11900,
      status: "confirmed",
    });
  });

  it("cobrança duplicada no mesmo lote (paginação) não repete a linha no INSERT", async () => {
    h.selectResults = [[{ id: MEMBER, planId: PLAN }]];
    h.gateway!.gateway.listSubscriptionPayments = async () => [
      payment({ gatewayPaymentId: "pay_1", valueCents: 100 }),
      payment({ gatewayPaymentId: "pay_1", valueCents: 100 }),
      payment({ gatewayPaymentId: "pay_2", valueCents: 200 }),
    ];
    const r = await recordSubscriptionPayments("sub_1");
    expect(h.inserts[0].rows.map((x) => x.gatewayPaymentId)).toEqual(["pay_1", "pay_2"]);
    expect(r).toEqual({ status: "recorded", upserted: 2, skipped: 0 });
  });

  it("status desconhecido é pulado e contado (não é gravado)", async () => {
    h.selectResults = [[{ id: MEMBER, planId: PLAN }]];
    h.gateway!.gateway.listSubscriptionPayments = async () => [
      payment({ gatewayPaymentId: "pay_1" }),
      payment({ gatewayPaymentId: "pay_9", status: "STATUS_NOVO" }),
    ];
    const r = await recordSubscriptionPayments("sub_1");
    expect(r).toEqual({ status: "recorded", upserted: 1, skipped: 1 });
    expect([...applyUpserts().keys()]).toEqual(["pay_1"]);
  });

  it("assinatura sem sócio → not_found: nada gravado e o gateway nem é consultado", async () => {
    h.selectResults = [[]];
    const r = await recordSubscriptionPayments("sub_desconhecida");
    expect(r).toEqual({ status: "not_found" });
    expect(h.gatewayCalls).toEqual([]);
    expect(h.inserts).toEqual([]);
  });

  it("id de assinatura vazio → not_found sem tocar no banco", async () => {
    const r = await recordSubscriptionPayments("");
    expect(r).toEqual({ status: "not_found" });
    expect(h.selectResults).toEqual([]);
  });

  it("gateway ativo sem listagem de cobranças → unsupported (sem ledger)", async () => {
    h.selectResults = [[{ id: MEMBER, planId: PLAN }]];
    h.gateway = { slug: "mercadopago", gateway: {} };
    const r = await recordSubscriptionPayments("sub_1");
    expect(r).toEqual({ status: "unsupported" });
    expect(h.inserts).toEqual([]);
  });

  it("falha no gateway propaga o erro, mas marca o sócio como sincronizado (fila não trava)", async () => {
    h.selectResults = [[{ id: MEMBER, planId: PLAN }]];
    h.gateway!.gateway.listSubscriptionPayments = async () => {
      throw new Error("ASAAS 500");
    };
    await expect(recordSubscriptionPayments("sub_1")).rejects.toThrow("ASAAS 500");
    expect(h.memberUpdates).toHaveLength(1);
    expect(h.memberUpdates[0]).toHaveProperty("ledgerSyncedAt");
    expect(h.inserts).toEqual([]);
  });
});

describe("recordRecentMembershipPayments (cron)", () => {
  it("um sócio com erro não derruba o lote e é contado como falha", async () => {
    h.selectResults = [
      [
        { id: MEMBER, planId: PLAN, subscriptionId: "sub_ok" },
        { id: "2c6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f", planId: null, subscriptionId: "sub_erro" },
      ],
    ];
    h.gateway!.gateway.listSubscriptionPayments = async (id: string) => {
      if (id === "sub_erro") throw new Error("boom");
      return [payment()];
    };
    const r = await recordRecentMembershipPayments(50);
    expect(r).toEqual({ checked: 2, recorded: 1, failed: 1 });
  });

  it("sem gateway com listagem → não faz nada", async () => {
    h.gateway = null;
    expect(await recordRecentMembershipPayments()).toEqual({ checked: 0, recorded: 0, failed: 0 });
  });
});

describe("importMembershipPaymentsBatch (backfill)", () => {
  it("lote cheio devolve o cursor (último id); lote parcial encerra com nextCursor null", async () => {
    const ids = [
      "10000000-0000-4000-8000-000000000001",
      "10000000-0000-4000-8000-000000000002",
    ];
    h.selectResults = [ids.map((id) => ({ id, planId: null, subscriptionId: `sub_${id.slice(-1)}` }))];
    const cheio = await importMembershipPaymentsBatch(null, 2);
    expect(cheio).toMatchObject({ supported: true, processed: 2, failed: 0, nextCursor: ids[1] });

    h.selectResults = [[{ id: ids[0], planId: null, subscriptionId: "sub_1" }]];
    const parcial = await importMembershipPaymentsBatch(null, 2);
    expect(parcial.nextCursor).toBeNull();
  });

  it("gateway sem histórico → supported false", async () => {
    h.gateway = { slug: "mercadopago", gateway: {} };
    expect(await importMembershipPaymentsBatch(null)).toEqual({
      supported: false,
      processed: 0,
      failed: 0,
      nextCursor: null,
    });
  });
});
