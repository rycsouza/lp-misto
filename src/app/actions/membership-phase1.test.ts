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
        return { gatewayCustomerId: "cus_1", subscriptionId: "sub_new", paymentMethod: "card" };
      },
    },
  }),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
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

  it("pendente sem pagamento → cancela a assinatura anterior no gateway e desvincula", async () => {
    h.results = [PLAN, [{ id: MEMBER_ID, status: "pending", subscriptionId: "sub_old", gatewaySlug: "asaas" }]];
    const r = await signupMember({ ...base, asaasCardData });
    expect(h.cancelled).toEqual(["sub_old"]);
    expect(h.updates[0]).toMatchObject({ status: "pending", subscriptionId: null });
    expect(h.created).toBe(1);
    expect(r.success).toBe(true);
    expect(typeof r.cardToken).toBe("string");
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
