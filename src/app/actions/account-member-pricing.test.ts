import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * getMyMemberPricing: o desconto de sócio para EXIBIR preço. Só o cliente logado
 * recebe algo; devolve só percentuais e o nome do plano (nunca e-mail ou ids);
 * visitante sem sessão não consome limite nem consulta o banco.
 */
const h = vi.hoisted(() => ({
  session: null as null | { id: string; email: string },
  row: null as null | Record<string, unknown>,
  limited: false,
  rateCalls: 0,
  dbCalls: 0,
}));

vi.mock("@/lib/accounts/session", () => ({
  getCustomerAccount: async () => h.session,
  startAccountSession: async () => true,
  endAccountSession: async () => {},
}));
vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "innerJoin", "where"]) chain[m] = () => chain;
  chain.limit = async () => {
    h.dbCalls++;
    return h.row ? [h.row] : [];
  };
  return { getDb: async () => chain };
});
vi.mock("@/lib/ratelimit", () => ({
  getClientIp: async () => "203.0.113.10",
  rateLimit: async () => {
    h.rateCalls++;
    return { ok: !h.limited, remaining: 0 };
  },
}));
vi.mock("@/lib/base-url", () => ({
  getCurrentTenantSlug: async () => "clube-a",
  getAppBaseUrl: async () => "https://clube.example",
}));
vi.mock("@/lib/email", () => ({
  sendAccountVerifyEmail: async () => true,
  sendAccountResetEmail: async () => true,
  sendAccountExistsEmail: async () => true,
}));
vi.mock("@/lib/orders/enrich", () => ({
  loadOrdersForVerifiedEmail: async () => [],
}));

import { getMyMemberPricing } from "./account";

const ACTIVE = {
  status: "active",
  nextBillingDate: new Date(Date.now() + 10 * 86_400_000),
  ticketDiscountPct: 15,
  productDiscountPct: 10,
  planName: "Carcará",
};

beforeEach(() => {
  h.session = null;
  h.row = ACTIVE;
  h.limited = false;
  h.rateCalls = 0;
  h.dbCalls = 0;
});

describe("getMyMemberPricing", () => {
  it("sem sessão → null, sem limite e sem consultar sócio", async () => {
    expect(await getMyMemberPricing()).toBeNull();
    expect(h.rateCalls).toBe(0);
    expect(h.dbCalls).toBe(0);
  });

  it("logado sem cadastro de sócio → null", async () => {
    h.session = { id: "conta-1", email: "fan@example.com" };
    h.row = null;
    expect(await getMyMemberPricing()).toBeNull();
  });

  it("logado, sócio com benefício vigente → só percentuais e nome do plano", async () => {
    h.session = { id: "conta-1", email: "socio@example.com" };
    const result = await getMyMemberPricing();
    expect(result).toEqual({ ticketDiscountPct: 15, productDiscountPct: 10, planName: "Carcará" });
    expect(Object.keys(result ?? {}).sort()).toEqual(["planName", "productDiscountPct", "ticketDiscountPct"]);
  });

  it("logado, assinatura suspensa → null (sem benefício vigente)", async () => {
    h.session = { id: "conta-1", email: "socio@example.com" };
    h.row = { ...ACTIVE, status: "suspended" };
    expect(await getMyMemberPricing()).toBeNull();
  });

  it("limite de tentativas estourado → null, sem consultar o banco", async () => {
    h.session = { id: "conta-1", email: "socio@example.com" };
    h.limited = true;
    expect(await getMyMemberPricing()).toBeNull();
    expect(h.dbCalls).toBe(0);
  });
});
