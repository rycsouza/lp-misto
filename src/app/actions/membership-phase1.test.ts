import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Sócio-torcedor — fase 1:
 * - nova tentativa de quem ficou pendente não deixa assinatura órfã no gateway
 * - quem já é sócio recebe o código "already_member" (UI aponta p/ carteirinha)
 * - status da adesão por token: só status, reconsulta o gateway quando pendente
 * - desconto de sócio não é mais server action pública (enumeração de sócios)
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const TOKEN = "5f0d1c9e-8a7b-4c3d-9e2f-1a2b3c4d5e6f";

const h = vi.hoisted(() => ({
  results: [] as unknown[],
  updates: [] as Record<string, unknown>[],
  dbCalls: 0,
  syncResult: "pending" as string,
  syncCalls: [] as string[],
  cancelled: [] as string[],
  created: 0,
  rateOk: true,
  gatewayFails: false,
  session: null as { email: string } | null,
}));

function fakeDb(): unknown {
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, prop) => {
      if (prop === "then") {
        const value = h.results.length ? h.results.shift() : [];
        return (resolve: (v: unknown) => void) => resolve(value);
      }
      if (prop === "set") {
        return (v: Record<string, unknown>) => {
          h.updates.push(v);
          return chain;
        };
      }
      return () => chain;
    },
    apply: () => chain,
  });
  return { select: () => chain, insert: () => chain, update: () => chain };
}

vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    h.dbCalls++;
    return fakeDb();
  },
}));
vi.mock("@/lib/payment/card-ratelimit", () => ({
  CARD_RATE_LIMIT_ERROR: "LIMITE",
  MEMBER_CARD_RATE_LIMIT_ERROR: "LIMITE",
  checkCardAttemptLimit: async () => true,
}));
vi.mock("@/lib/ratelimit", () => ({
  rateLimit: async () => ({ ok: h.rateOk, remaining: 0 }),
  getClientIp: async () => "203.0.113.10",
}));
vi.mock("@/lib/membership/sync", () => ({
  syncMemberSubscription: async (id: string) => {
    h.syncCalls.push(id);
    return h.syncResult;
  },
  syncMemberById: async (id: string) => {
    h.syncCalls.push(id);
    return h.syncResult;
  },
}));
vi.mock("@/lib/payment/subscription-factory", () => ({
  getSubscriptionGateway: async () => ({
    slug: "asaas",
    gateway: {
      cancelSubscription: async (id: string) => {
        h.cancelled.push(id);
        return true;
      },
      createSubscription: async () => {
        h.created++;
        if (h.gatewayFails) throw new Error("ASAAS 400 /subscriptions: invalid_creditCard");
        return { gatewayCustomerId: "cus_1", subscriptionId: "sub_new", paymentMethod: "card" };
      },
    },
  }),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/accounts/session", () => ({ getCustomerAccount: async () => h.session }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import * as membershipActions from "./membership";
const { signupMember, getMembershipStatus } = membershipActions;

const base = {
  name: "Titular Exemplo",
  email: "titular@example.com",
  whatsapp: "11900000000",
  cpf: "52998224725",
  planId: "1b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f",
};
const asaasCardData = {
  holderName: "TITULAR EXEMPLO",
  number: "4000000000000010",
  expiryMonth: "12",
  expiryYear: "2030",
  ccv: "123",
  postalCode: "01001000",
  addressNumber: "1",
};
const PLAN = [{ id: base.planId, active: true, name: "Ouro", priceCents: 2990 }];

beforeEach(() => {
  h.results = [];
  h.updates = [];
  h.dbCalls = 0;
  h.syncResult = "pending";
  h.syncCalls = [];
  h.cancelled = [];
  h.created = 0;
  h.rateOk = true;
  h.gatewayFails = false;
  h.session = null;
});

describe("signupMember — nova tentativa e sócio existente", () => {
  it("sócio ativo → already_member, sem criar assinatura", async () => {
    h.results = [PLAN, [{ id: MEMBER_ID, status: "active", subscriptionId: "sub_old", gatewaySlug: "asaas" }]];
    const r = await signupMember({ ...base, asaasCardData });
    expect(r).toMatchObject({ success: false, code: "already_member" });
    expect(h.created).toBe(0);
  });

  it("pendente cuja assinatura anterior JÁ foi paga → already_member, sem cancelar nem criar", async () => {
    h.syncResult = "active";
    h.results = [PLAN, [{ id: MEMBER_ID, status: "pending", subscriptionId: "sub_old", gatewaySlug: "asaas" }]];
    const r = await signupMember({ ...base, asaasCardData });
    expect(r).toMatchObject({ success: false, code: "already_member" });
    expect(h.cancelled).toEqual([]);
    expect(h.created).toBe(0);
  });

  it("pendente sem pagamento → nova assinatura aceita, cancela a anterior e grava tudo de uma vez", async () => {
    h.results = [PLAN, [{ id: MEMBER_ID, status: "pending", subscriptionId: "sub_old", gatewaySlug: "asaas" }]];
    const r = await signupMember({ ...base, asaasCardData });
    expect(h.created).toBe(1);
    expect(h.cancelled).toEqual(["sub_old"]);
    // Um único update, depois do sucesso: cadastro + nova assinatura (a anterior desvinculada).
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0]).toMatchObject({ status: "pending", subscriptionId: "sub_new", name: base.name });
    expect(r.success).toBe(true);
    expect(typeof r.cardToken).toBe("string");
  });

  it("cartão recusado numa readesão: NADA muda no cadastro existente nem na assinatura anterior (auditoria run-2)", async () => {
    h.gatewayFails = true;
    h.results = [PLAN, [{ id: MEMBER_ID, status: "pending", subscriptionId: "sub_old", gatewaySlug: "asaas" }]];
    const r = await signupMember({ ...base, name: "Outra Pessoa", asaasCardData });
    expect(r.success).toBe(false);
    expect(h.updates).toEqual([]);
    expect(h.cancelled).toEqual([]);
  });

  it("cancelado ainda no período pago, sem login do dono: recusa sem tocar em nada", async () => {
    const future = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    h.results = [PLAN, [{ id: MEMBER_ID, status: "cancelled", subscriptionId: null, gatewaySlug: "asaas", nextBillingDate: future }]];
    const r = await signupMember({ ...base, asaasCardData });
    expect(r).toMatchObject({ success: false, code: "already_member" });
    expect(h.created).toBe(0);
    expect(h.updates).toEqual([]);
  });

  it("cancelado ainda no período pago, logado com OUTRO e-mail: recusa", async () => {
    h.session = { email: "outra@example.com" };
    const future = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    h.results = [PLAN, [{ id: MEMBER_ID, status: "cancelled", subscriptionId: null, gatewaySlug: "asaas", nextBillingDate: future }]];
    expect((await signupMember({ ...base, asaasCardData })).success).toBe(false);
    expect(h.created).toBe(0);
  });

  it("cancelado ainda no período pago, logado com o MESMO e-mail: renova normalmente", async () => {
    h.session = { email: "Titular@Example.com" };
    const future = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    h.results = [PLAN, [{ id: MEMBER_ID, status: "cancelled", subscriptionId: null, gatewaySlug: "asaas", nextBillingDate: future }]];
    const r = await signupMember({ ...base, asaasCardData });
    expect(r.success).toBe(true);
    expect(h.created).toBe(1);
  });

  it("cancelado com período já vencido: readesão segue sem login (sem atrito na compra)", async () => {
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    h.results = [PLAN, [{ id: MEMBER_ID, status: "cancelled", subscriptionId: null, gatewaySlug: "asaas", nextBillingDate: past }]];
    const r = await signupMember({ ...base, asaasCardData });
    expect(r.success).toBe(true);
    expect(h.created).toBe(1);
  });

  it("assinatura anterior de OUTRO gateway não é cancelada por engano", async () => {
    h.results = [PLAN, [{ id: MEMBER_ID, status: "pending", subscriptionId: "mp_old", gatewaySlug: "mercadopago" }]];
    await signupMember({ ...base, asaasCardData });
    expect(h.cancelled).toEqual([]);
  });
});

describe("getMembershipStatus (tela de sucesso)", () => {
  it("token inválido → not_found sem tocar o banco", async () => {
    expect(await getMembershipStatus("abc")).toEqual({ status: "not_found" });
    expect(h.dbCalls).toBe(0);
  });

  it("ativo → active, sem reconsultar o gateway", async () => {
    h.results = [[{ id: MEMBER_ID, status: "active" }]];
    expect(await getMembershipStatus(TOKEN)).toEqual({ status: "active" });
    expect(h.syncCalls).toEqual([]);
  });

  it("pendente → reconsulta o gateway e devolve active quando pago", async () => {
    h.results = [[{ id: MEMBER_ID, status: "pending" }]];
    h.syncResult = "active";
    expect(await getMembershipStatus(TOKEN)).toEqual({ status: "active" });
    expect(h.syncCalls).toEqual([MEMBER_ID]);
  });

  it("pendente com limite estourado → não martela o gateway", async () => {
    h.results = [[{ id: MEMBER_ID, status: "pending" }]];
    h.rateOk = false;
    expect(await getMembershipStatus(TOKEN)).toEqual({ status: "pending" });
    expect(h.syncCalls).toEqual([]);
  });

  it("devolve só o status (nenhum dado pessoal)", async () => {
    h.results = [[{ id: MEMBER_ID, status: "active", name: "X", email: "x@example.com" }]];
    expect(Object.keys(await getMembershipStatus(TOKEN))).toEqual(["status"]);
  });
});

describe("desconto de sócio não é endpoint público", () => {
  it("getMemberDiscountForEmail não é mais exportada pelas server actions", () => {
    expect((membershipActions as Record<string, unknown>).getMemberDiscountForEmail).toBeUndefined();
  });
});
