import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Desconto de sócio no checkout: vale SÓ para a conta logada (e-mail
 * confirmado). O e-mail digitado na compra não é verificado — não pode dar o
 * desconto de um sócio a quem só sabe o e-mail dele.
 */
const h = vi.hoisted(() => ({
  session: null as null | { email: string },
  row: null as unknown,
  queriedEmails: [] as string[],
}));

vi.mock("@/lib/accounts/session", () => ({ getCustomerAccount: async () => h.session }));
vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "innerJoin"]) chain[m] = () => chain;
  chain.where = () => {
    h.queriedEmails.push("consultou");
    return chain;
  };
  chain.limit = async () => (h.row ? [h.row] : []);
  return { getDb: async () => chain };
});

import { getSessionMemberDiscount } from "./discount";

const ACTIVE = {
  status: "active",
  nextBillingDate: new Date(Date.now() + 10 * 86_400_000),
  ticketDiscountPct: 0,
  productDiscountPct: 10,
  planName: "Carcará",
};

beforeEach(() => {
  h.session = null;
  h.row = ACTIVE;
  h.queriedEmails = [];
});

describe("getSessionMemberDiscount", () => {
  it("sem sessão → sem desconto e sem consultar sócio", async () => {
    expect(await getSessionMemberDiscount()).toBeNull();
    expect(h.queriedEmails).toEqual([]);
  });

  it("logado como sócio ativo → desconto do plano", async () => {
    h.session = { email: "socio@example.com" };
    expect(await getSessionMemberDiscount()).toEqual({ ticketDiscountPct: 0, productDiscountPct: 10, planName: "Carcará" });
  });

  it("logado, mas assinatura suspensa → sem desconto", async () => {
    h.session = { email: "socio@example.com" };
    h.row = { ...ACTIVE, status: "suspended" };
    expect(await getSessionMemberDiscount()).toBeNull();
  });
});
