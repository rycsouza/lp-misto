import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Sócio-torcedor: a ativação vem do GATEWAY (fonte da verdade), nunca do corpo
 * do webhook. Cobre a corrida webhook × cadastro (sócio achado pela referência
 * externa da assinatura) e a autorrecuperação por id.
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";

const h = vi.hoisted(() => ({
  results: [] as unknown[],
  updates: [] as Record<string, unknown>[],
  dbCalls: 0,
  paid: false,
  externalRef: null as string | null,
  gatewayHasMethods: true,
  activated: [] as string[],
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
  return { select: () => chain, update: () => chain };
}

vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    h.dbCalls++;
    return fakeDb();
  },
}));
vi.mock("@/lib/payment/subscription-factory", () => ({
  getSubscriptionGateway: async () => ({
    slug: "asaas",
    gateway: h.gatewayHasMethods
      ? {
          hasPaidCharge: async () => h.paid,
          getSubscriptionExternalReference: async () => h.externalRef,
        }
      : {},
  }),
}));
vi.mock("./subscription", () => ({
  activateMemberBySubscription: async (id: string) => {
    h.activated.push(id);
  },
}));

import { syncMemberSubscription, syncMemberById } from "./sync";

beforeEach(() => {
  h.results = [];
  h.updates = [];
  h.dbCalls = 0;
  h.paid = false;
  h.externalRef = null;
  h.gatewayHasMethods = true;
  h.activated = [];
});

describe("syncMemberSubscription", () => {
  it("sócio pendente com cobrança paga no gateway → ativa", async () => {
    h.results = [[{ id: MEMBER_ID, status: "pending" }]];
    h.paid = true;
    expect(await syncMemberSubscription("sub_1")).toBe("active");
    expect(h.activated).toEqual(["sub_1"]);
  });

  it("sem cobrança paga no gateway → continua pendente (não confia no webhook)", async () => {
    h.results = [[{ id: MEMBER_ID, status: "pending" }]];
    h.paid = false;
    expect(await syncMemberSubscription("sub_1")).toBe("pending");
    expect(h.activated).toEqual([]);
  });

  it("corrida: webhook antes do subscriptionId gravado → acha pelo externalReference e vincula", async () => {
    // 1) busca por subscriptionId: nada; 2) update ... returning: o sócio vinculado
    h.results = [[], [{ id: MEMBER_ID, status: "pending" }]];
    h.externalRef = MEMBER_ID;
    h.paid = true;
    expect(await syncMemberSubscription("sub_1")).toBe("active");
    expect(h.updates[0]).toMatchObject({ subscriptionId: "sub_1", gatewaySlug: "asaas" });
    expect(h.activated).toEqual(["sub_1"]);
  });

  it("externalReference que não é UUID → not_found, sem gravar nada", async () => {
    h.results = [[]];
    h.externalRef = "'; drop table members; --";
    expect(await syncMemberSubscription("sub_1")).toBe("not_found");
    expect(h.updates).toEqual([]);
  });

  it("sócio já ativo → não reconsulta pagamento nem reativa", async () => {
    h.results = [[{ id: MEMBER_ID, status: "active" }]];
    h.paid = true;
    expect(await syncMemberSubscription("sub_1")).toBe("active");
    expect(h.activated).toEqual([]);
  });

  it("gateway sem consulta de pagamento → unsupported, sem tocar o banco", async () => {
    h.gatewayHasMethods = false;
    expect(await syncMemberSubscription("sub_1")).toBe("unsupported");
    expect(h.dbCalls).toBe(0);
  });
});

describe("syncMemberById", () => {
  it("id que não é UUID → not_found sem consultar o banco", async () => {
    expect(await syncMemberById("abc")).toBe("not_found");
    expect(h.dbCalls).toBe(0);
  });

  it("pendente com assinatura → sincroniza e ativa se pago", async () => {
    h.results = [[{ status: "pending", subscriptionId: "sub_1" }], [{ id: MEMBER_ID, status: "pending" }]];
    h.paid = true;
    expect(await syncMemberById(MEMBER_ID)).toBe("active");
    expect(h.activated).toEqual(["sub_1"]);
  });

  it("pendente sem assinatura (ex.: gateway falhou na adesão) → segue pendente", async () => {
    h.results = [[{ status: "pending", subscriptionId: null }]];
    expect(await syncMemberById(MEMBER_ID)).toBe("pending");
    expect(h.activated).toEqual([]);
  });
});
