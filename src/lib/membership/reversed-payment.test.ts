import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Estorno/chargeback (auditoria run-2, Moderado): encerra o sócio dono da cobrança mesmo quando
 * ela não é da assinatura atual (troca de plano) ou é a cobrança avulsa do Pix Automático.
 */
const MEMBER = "11111111-2222-4333-8444-555555555555";
const h = vi.hoisted(() => ({
  selects: [] as unknown[][],
  updates: [] as { set: Record<string, unknown> }[],
  externalRef: null as string | null,
  extCalls: [] as string[],
}));

function fakeDb(): unknown {
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, prop) => {
      if (prop === "then") {
        const v = h.selects.length ? h.selects.shift() : [];
        return (resolve: (x: unknown) => void) => resolve(v);
      }
      return () => chain;
    },
    apply: () => chain,
  });
  return {
    select: () => chain,
    update: () => ({
      set: (set: Record<string, unknown>) => {
        h.updates.push({ set });
        return { where: async () => [] };
      },
    }),
  };
}
vi.mock("@/lib/db/client", () => ({ getDb: async () => fakeDb() }));
vi.mock("@/lib/email", () => ({ sendMemberWelcomeEmail: async () => true }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/payment/subscription-factory", () => ({
  getSubscriptionGateway: async () => ({
    slug: "asaas",
    gateway: {
      getSubscriptionExternalReference: async (id: string) => {
        h.extCalls.push(id);
        return h.externalRef;
      },
    },
  }),
}));

import { cancelMemberForReversedPayment } from "./subscription";

beforeEach(() => {
  h.selects = [];
  h.updates = [];
  h.externalRef = null;
  h.extCalls = [];
});

describe("cancelMemberForReversedPayment", () => {
  it("assinatura atual: encerra na hora (benefício até agora)", async () => {
    h.selects = [[{ id: MEMBER }]];
    expect(await cancelMemberForReversedPayment({ subscriptionId: "sub_1", paymentId: "pay_1" })).toBe(1);
    expect(h.updates[0].set).toMatchObject({ status: "cancelled" });
    expect((h.updates[0].set.nextBillingDate as Date).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("assinatura anterior (troca de plano): acha pelo ledger da cobrança", async () => {
    h.selects = [[], [{ memberId: MEMBER }]];
    expect(await cancelMemberForReversedPayment({ subscriptionId: "sub_old", paymentId: "pay_old" })).toBe(1);
    expect(h.extCalls).toEqual([]);
  });

  it("fora do ledger: acha pela referência externa relida no gateway", async () => {
    h.selects = [[], []];
    h.externalRef = MEMBER;
    expect(await cancelMemberForReversedPayment({ subscriptionId: "sub_old", paymentId: "pay_x" })).toBe(1);
    expect(h.extCalls).toEqual(["sub_old"]);
  });

  it("cobrança avulsa do Pix Automático (sem assinatura): acha pelo cliente do gateway", async () => {
    h.selects = [[], [{ id: MEMBER }]];
    expect(await cancelMemberForReversedPayment({ paymentId: "pay_qr", customerId: "cus_1" })).toBe(1);
  });

  it("referência externa que não é UUID ou nenhuma pista: não encerra ninguém", async () => {
    h.selects = [[], []];
    h.externalRef = "nao-e-uuid";
    expect(await cancelMemberForReversedPayment({ subscriptionId: "sub_z", paymentId: "pay_z" })).toBe(0);
    expect(await cancelMemberForReversedPayment({})).toBe(0);
    expect(h.updates).toEqual([]);
  });
});
