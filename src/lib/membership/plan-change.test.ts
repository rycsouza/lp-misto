import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Troca de plano sem alterar valor no gateway: nova assinatura com 1ª cobrança
 * no PRÓXIMO VENCIMENTO, vincula, e só então cancela a atual. Se cancelar a
 * atual falhar, desfaz tudo (nunca duas cobranças ativas). Só cartão.
 */
const MEMBER = {
  id: "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f",
  name: "Titular",
  email: "titular@example.com",
  whatsapp: "5511900000000",
  cpf: "52998224725",
  status: "active",
  planId: "11111111-1111-4111-8111-111111111111",
  pendingPlanId: null,
  subscriptionId: "sub_old",
  gatewaySlug: "asaas",
  nextBillingDate: new Date("2099-11-12T15:00:00Z"),
};
const CNPJ_DIGITS = "11222333000181";
const NEW_PLAN = { id: "22222222-2222-4222-8222-222222222222", name: "Ouro", priceCents: 4990, active: true, audience: "pf" };
const CARD = {
  holderName: "TITULAR EXEMPLO",
  number: "4000000000000010",
  expiryMonth: "12",
  expiryYear: "2030",
  ccv: "123",
  postalCode: "01001000",
  addressNumber: "1",
};

const h = vi.hoisted(() => ({
  results: [] as unknown[],
  updates: [] as Record<string, unknown>[],
  log: [] as string[],
  created: [] as Record<string, unknown>[],
  failCancelOld: false,
  failCreate: false,
  slug: "asaas",
  dbCalls: 0,
}));

function fakeDb(): unknown {
  h.dbCalls++;
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, prop) => {
      if (prop === "then") {
        const value = h.results.length ? h.results.shift() : [];
        return (resolve: (v: unknown) => void) => resolve(value);
      }
      if (prop === "set") return (v: Record<string, unknown>) => { h.updates.push(v); h.log.push(`db:${JSON.stringify(v.subscriptionId)}`); return chain; };
      return () => chain;
    },
    apply: () => chain,
  });
  return { select: () => chain, update: () => chain };
}

vi.mock("@/lib/db/client", () => ({ getDb: async () => fakeDb() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/date", () => ({ todayBrasilia: () => "2099-10-12" }));
vi.mock("@/lib/payment/subscription-factory", () => ({
  getSubscriptionGateway: async () => ({
    slug: h.slug,
    gateway: {
      createSubscription: async (input: Record<string, unknown>) => {
        if (h.failCreate) throw new Error("recusado");
        h.created.push(input);
        h.log.push("create");
        return { subscriptionId: "sub_new", gatewayCustomerId: "cus_2", paymentMethod: "card" };
      },
      cancelSubscription: async (id: string) => {
        h.log.push(`cancel:${id}`);
        if (id === "sub_old" && h.failCancelOld) throw new Error("falhou");
        return true;
      },
    },
  }),
}));

import { changeMemberPlan } from "./plan-change";

beforeEach(() => {
  Object.assign(h, { results: [[MEMBER], [NEW_PLAN]], updates: [], log: [], created: [], failCancelOld: false, failCreate: false, slug: "asaas", dbCalls: 0 });
});

describe("changeMemberPlan", () => {
  it("nova assinatura começa no próximo vencimento, com o cartão; vincula ANTES de cancelar a atual", async () => {
    const r = await changeMemberPlan({ memberId: MEMBER.id, newPlanId: NEW_PLAN.id, asaasCardData: CARD });
    expect(r).toEqual({ ok: true, startsOn: "2099-11-12", planName: "Ouro" });
    expect(h.created[0]).toMatchObject({ firstDueDate: "2099-11-12", amountCents: 4990, externalRef: MEMBER.id, asaasCardData: CARD });
    expect(h.log).toEqual(["create", 'db:"sub_new"', "cancel:sub_old"]);
    expect(h.updates[0]).toMatchObject({ subscriptionId: "sub_new", pendingPlanId: NEW_PLAN.id });
  });

  it("falha ao cancelar a atual → volta o vínculo e cancela a nova", async () => {
    h.failCancelOld = true;
    const r = await changeMemberPlan({ memberId: MEMBER.id, newPlanId: NEW_PLAN.id, asaasCardData: CARD });
    expect(r).toEqual({ ok: false, error: "gateway_error" });
    expect(h.log).toEqual(["create", 'db:"sub_new"', "cancel:sub_old", 'db:"sub_old"', "cancel:sub_new"]);
  });

  it("falha ao criar a nova → nada muda", async () => {
    h.failCreate = true;
    expect(await changeMemberPlan({ memberId: MEMBER.id, newPlanId: NEW_PLAN.id, asaasCardData: CARD })).toEqual({ ok: false, error: "gateway_error" });
    expect(h.updates).toEqual([]);
    expect(h.log).toEqual([]);
  });

  it("sem dados do cartão → card_required, sem consultar o banco nem o gateway", async () => {
    expect(await changeMemberPlan({ memberId: MEMBER.id, newPlanId: NEW_PLAN.id })).toEqual({ ok: false, error: "card_required" });
    expect(h.dbCalls).toBe(0);
    expect(h.created).toEqual([]);
    expect(h.log).toEqual([]);
  });

  it("troca pf → pj (ou pj → pf) é bloqueada, sem gateway nem gravação", async () => {
    // Sócio de CPF tentando plano empresarial
    h.results = [[MEMBER], [{ ...NEW_PLAN, audience: "pj" }]];
    expect(await changeMemberPlan({ memberId: MEMBER.id, newPlanId: NEW_PLAN.id, asaasCardData: CARD })).toEqual({
      ok: false,
      error: "audience_mismatch",
    });
    expect(h.created).toEqual([]);
    expect(h.log).toEqual([]);
    expect(h.updates).toEqual([]);

    // Sócio empresarial tentando plano de CPF
    h.results = [[{ ...MEMBER, cpf: null, cnpj: CNPJ_DIGITS, companyName: "Padaria Bom Pão Ltda" }], [NEW_PLAN]];
    expect(await changeMemberPlan({ memberId: MEMBER.id, newPlanId: NEW_PLAN.id, asaasCardData: CARD })).toEqual({
      ok: false,
      error: "audience_mismatch",
    });
    expect(h.created).toEqual([]);
    expect(h.updates).toEqual([]);
  });

  it("troca dentro do mesmo tipo empresarial continua: a nova cobrança leva o CNPJ e a razão social", async () => {
    const empresa = { ...MEMBER, cpf: null, cnpj: CNPJ_DIGITS, companyName: "Padaria Bom Pão Ltda" };
    h.results = [[empresa], [{ ...NEW_PLAN, audience: "pj" }]];
    const r = await changeMemberPlan({ memberId: MEMBER.id, newPlanId: NEW_PLAN.id, asaasCardData: CARD });
    expect(r).toMatchObject({ ok: true, planName: "Ouro" });
    expect(h.created[0]).toMatchObject({ cnpj: CNPJ_DIGITS, companyName: "Padaria Bom Pão Ltda", firstDueDate: "2099-11-12" });
    expect(h.created[0]).not.toHaveProperty("cpf");
  });

  it("regras: só ativo; mesmo plano; plano inativo; gateway diferente", async () => {
    h.results = [[{ ...MEMBER, status: "suspended" }]];
    expect((await changeMemberPlan({ memberId: MEMBER.id, newPlanId: NEW_PLAN.id, asaasCardData: CARD })).ok).toBe(false);
    h.results = [[MEMBER]];
    expect(await changeMemberPlan({ memberId: MEMBER.id, newPlanId: MEMBER.planId, asaasCardData: CARD })).toEqual({ ok: false, error: "same_plan" });
    h.results = [[MEMBER], [{ ...NEW_PLAN, active: false }]];
    expect(await changeMemberPlan({ memberId: MEMBER.id, newPlanId: NEW_PLAN.id, asaasCardData: CARD })).toEqual({ ok: false, error: "plan_unavailable" });
    h.results = [[MEMBER], [NEW_PLAN]];
    h.slug = "mercadopago";
    expect(await changeMemberPlan({ memberId: MEMBER.id, newPlanId: NEW_PLAN.id, asaasCardData: CARD })).toEqual({ ok: false, error: "unsupported_gateway" });
    expect(h.log).toEqual([]);
  });
});
