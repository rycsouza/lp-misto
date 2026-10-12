import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Sócio-torcedor: a situação vem do GATEWAY (fonte da verdade), nunca do corpo
 * do webhook. Cobre ativação, carência/suspensão, volta após pagar, corrida
 * webhook × cadastro e o fallback para gateways que só dizem "pagou?".
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";

const h = vi.hoisted(() => ({
  results: [] as unknown[],
  updates: [] as Record<string, unknown>[],
  dbCalls: 0,
  billing: {
    hasPaid: false,
    oldestOverdueDueDate: null as string | null,
    nextDueDate: null as string | null,
    openInvoiceUrl: null as string | null,
  },
  externalRef: null as string | null,
  mode: "billing" as "billing" | "paidOnly" | "none",
  activated: [] as { id: string; next: Date | null | undefined }[],
  suspended: [] as string[],
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
    gateway:
      h.mode === "none"
        ? {}
        : h.mode === "paidOnly"
        ? { hasPaidCharge: async () => h.billing.hasPaid }
        : {
            getBillingState: async () => h.billing,
            getSubscriptionExternalReference: async () => h.externalRef,
          },
  }),
}));
vi.mock("./subscription", () => ({
  activateMemberBySubscription: async (id: string, next?: Date | null) => {
    h.activated.push({ id, next });
  },
  suspendMemberBySubscription: async (id: string) => {
    h.suspended.push(id);
  },
}));

import { syncMemberSubscription, syncMemberById } from "./sync";

// Datas relativas a "agora" para os testes não envelhecerem.
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

beforeEach(() => {
  h.results = [];
  h.updates = [];
  h.dbCalls = 0;
  h.billing = { hasPaid: false, oldestOverdueDueDate: null, nextDueDate: null, openInvoiceUrl: null };
  h.externalRef = null;
  h.mode = "billing";
  h.activated = [];
  h.suspended = [];
});

describe("syncMemberSubscription — ativação", () => {
  it("pendente com mensalidade paga → ativa com o próximo vencimento do gateway", async () => {
    h.results = [[{ id: MEMBER_ID, status: "pending" }]];
    h.billing.hasPaid = true;
    h.billing.nextDueDate = "2026-11-12";
    expect(await syncMemberSubscription("sub_1")).toBe("active");
    expect(h.activated).toHaveLength(1);
    expect(h.activated[0].next?.toISOString().slice(0, 10)).toBe("2026-11-12");
  });

  it("sem pagamento → continua pendente (não confia no webhook)", async () => {
    h.results = [[{ id: MEMBER_ID, status: "pending" }]];
    expect(await syncMemberSubscription("sub_1")).toBe("pending");
    expect(h.activated).toEqual([]);
  });

  it("ativo e em dia → segue ativo e atualiza o próximo vencimento (renovação)", async () => {
    h.results = [[{ id: MEMBER_ID, status: "active" }]];
    h.billing.hasPaid = true;
    h.billing.nextDueDate = "2026-12-12";
    expect(await syncMemberSubscription("sub_1")).toBe("active");
    expect(h.activated).toHaveLength(1);
    expect(h.suspended).toEqual([]);
  });

  it("corrida: webhook antes do subscriptionId gravado → acha pelo externalReference e vincula", async () => {
    h.results = [[], [{ id: MEMBER_ID, status: "pending" }]];
    h.externalRef = MEMBER_ID;
    h.billing.hasPaid = true;
    expect(await syncMemberSubscription("sub_1")).toBe("active");
    expect(h.updates[0]).toMatchObject({ subscriptionId: "sub_1", gatewaySlug: "asaas" });
  });

  it("externalReference que não é UUID → not_found, sem gravar nada", async () => {
    h.results = [[]];
    h.externalRef = "'; drop table members; --";
    expect(await syncMemberSubscription("sub_1")).toBe("not_found");
    expect(h.updates).toEqual([]);
  });
});

describe("syncMemberSubscription — inadimplência (carência e suspensão)", () => {
  it("vencida DENTRO da carência → continua ativo", async () => {
    h.results = [[{ id: MEMBER_ID, status: "active" }]];
    h.billing.hasPaid = true;
    h.billing.oldestOverdueDueDate = daysAgo(2);
    expect(await syncMemberSubscription("sub_1")).toBe("active");
    expect(h.suspended).toEqual([]);
  });

  it("vencida ALÉM da carência → suspende", async () => {
    h.results = [[{ id: MEMBER_ID, status: "active" }]];
    h.billing.hasPaid = true;
    h.billing.oldestOverdueDueDate = daysAgo(10);
    expect(await syncMemberSubscription("sub_1")).toBe("suspended");
    expect(h.suspended).toEqual(["sub_1"]);
    expect(h.activated).toEqual([]);
  });

  it("suspenso que pagou o atraso → volta a ativo sozinho", async () => {
    h.results = [[{ id: MEMBER_ID, status: "suspended" }]];
    h.billing.hasPaid = true;
    h.billing.nextDueDate = "2026-12-12";
    expect(await syncMemberSubscription("sub_1")).toBe("active");
    expect(h.activated).toHaveLength(1);
  });

  it("suspenso ainda devendo → continua suspenso", async () => {
    h.results = [[{ id: MEMBER_ID, status: "suspended" }]];
    h.billing.hasPaid = true;
    h.billing.oldestOverdueDueDate = daysAgo(20);
    expect(await syncMemberSubscription("sub_1")).toBe("suspended");
    expect(h.activated).toEqual([]);
  });

  it("pendente que nunca pagou e venceu → segue pendente (não vira suspenso)", async () => {
    h.results = [[{ id: MEMBER_ID, status: "pending" }]];
    h.billing.oldestOverdueDueDate = daysAgo(10);
    expect(await syncMemberSubscription("sub_1")).toBe("pending");
    expect(h.suspended).toEqual([]);
  });

  it("cancelado não é alterado pelo gateway", async () => {
    h.results = [[{ id: MEMBER_ID, status: "cancelled" }]];
    h.billing.hasPaid = true;
    expect(await syncMemberSubscription("sub_1")).toBe("cancelled");
    expect(h.activated).toEqual([]);
  });
});

describe("syncMemberSubscription — gateways", () => {
  it("gateway que só informa 'pagou?' ainda ativa (fallback)", async () => {
    h.mode = "paidOnly";
    h.results = [[{ id: MEMBER_ID, status: "pending" }]];
    h.billing.hasPaid = true;
    expect(await syncMemberSubscription("sub_1")).toBe("active");
  });

  it("gateway sem consulta → unsupported, sem tocar o banco", async () => {
    h.mode = "none";
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
    h.billing.hasPaid = true;
    expect(await syncMemberById(MEMBER_ID)).toBe("active");
  });

  it("pendente sem assinatura (ex.: gateway falhou na adesão) → segue pendente", async () => {
    h.results = [[{ status: "pending", subscriptionId: null }]];
    expect(await syncMemberById(MEMBER_ID)).toBe("pending");
    expect(h.activated).toEqual([]);
  });
});
