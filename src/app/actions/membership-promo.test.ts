import { describe, it, expect, beforeEach, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

/**
 * Sócio-torcedor — "1º mês grátis" (só cartão Asaas):
 * - aplica: sócio ativo na hora, 1ª cobrança no mesmo dia do mês seguinte;
 * - não aplica: Mercado Pago, promoção vencida, plano sem promoção;
 * - sem cartão (ou pix no payload) → recusado antes de qualquer consulta;
 * - um por pessoa (e-mail OU CPF): sem assinatura até o cliente confirmar a cobrança cheia;
 * - falha do gateway com cartão → pendente, sem benefício; payload inválido → rejeitado.
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const PLAN_ID = "1b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";

const h = vi.hoisted(() => ({
  results: [] as unknown[],
  updates: [] as Record<string, unknown>[],
  wheres: [] as unknown[],
  inserts: 0,
  dbCalls: 0,
  today: "2026-10-14",
  rateOk: true,
  gatewaySlug: "asaas",
  gatewayNull: false,
  gatewayCreateError: null as Error | null,
  subscriptionInputs: [] as Record<string, unknown>[],
  welcome: [] as string[],
}));

// Banco falso: cada `await` de uma query consome o próximo item de `h.results`.
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
      if (prop === "where") {
        return (w: unknown) => {
          h.wheres.push(w);
          return chain;
        };
      }
      return () => chain;
    },
    apply: () => chain,
  });
  return {
    select: () => chain,
    insert: () => {
      h.inserts++;
      return chain;
    },
    update: () => chain,
  };
}

vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    h.dbCalls++;
    return fakeDb();
  },
}));
vi.mock("@/lib/date", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/date")>()),
  todayBrasilia: () => h.today,
}));
vi.mock("@/lib/payment/card-ratelimit", () => ({
  CARD_RATE_LIMIT_ERROR: "LIMITE",
  MEMBER_CARD_RATE_LIMIT_ERROR: "LIMITE",
  checkCardAttemptLimit: async () => h.rateOk,
}));
vi.mock("@/lib/membership/sync", () => ({
  syncMemberSubscription: async () => "pending",
  syncMemberById: async () => "pending",
}));
vi.mock("@/lib/payment/subscription-factory", () => ({
  getSubscriptionGateway: async () =>
    h.gatewayNull
      ? null
      : {
          slug: h.gatewaySlug,
          gateway: {
            cancelSubscription: async () => true,
            createSubscription: async (input: Record<string, unknown>) => {
              h.subscriptionInputs.push(input);
              if (h.gatewayCreateError) throw h.gatewayCreateError;
              return {
                gatewayCustomerId: "cus_1",
                subscriptionId: "sub_1",
                paymentMethod: "card",
                nextDueDate: input.firstDueDate,
              };
            },
          },
        },
}));
vi.mock("@/lib/email", () => ({
  sendMemberWelcomeEmail: async (id: string) => {
    h.welcome.push(id);
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { signupMember } from "./membership";

const PLAN_PROMO = [{ id: PLAN_ID, active: true, name: "Ouro", priceCents: 2990, firstMonthFree: true, promoEndsAt: null }];
const PLAN_SEM_PROMO = [{ ...PLAN_PROMO[0], firstMonthFree: false }];

const base = {
  name: "Titular Exemplo",
  email: "titular@example.com",
  whatsapp: "11900000000",
  cpf: "52998224725",
  planId: PLAN_ID,
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

/** Consultas com cláusula WHERE que tocam a elegibilidade (trial/pagamento). */
function eligibilityWheres(): { sql: string; params: unknown[] }[] {
  const dialect = new PgDialect();
  return h.wheres
    .map((w) => dialect.sqlToQuery(w as never))
    .filter((q) => q.sql.includes("trial_ends_at"));
}

beforeEach(() => {
  h.results = [];
  h.updates = [];
  h.wheres = [];
  h.inserts = 0;
  h.dbCalls = 0;
  h.today = "2026-10-14";
  h.rateOk = true;
  h.gatewaySlug = "asaas";
  h.gatewayNull = false;
  h.gatewayCreateError = null;
  h.subscriptionInputs = [];
  h.welcome = [];
});

describe("1º mês grátis — aplica", () => {
  it("cartão Asaas, plano vigente, elegível → ativo na hora, 1ª cobrança em 1 mês, boas-vindas", async () => {
    // plano, sócio existente, elegibilidade (ninguém), insert do sócio
    h.results = [PLAN_PROMO, [], [], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, asaasCardData });

    expect(r).toMatchObject({
      success: true,
      memberId: MEMBER_ID,
      paymentMethod: "card",
      promo: "applied",
      firstChargeDate: "2026-11-14",
    });
    expect(h.subscriptionInputs[0].firstDueDate).toBe("2026-11-14");
    const activation = h.updates.find((u) => "trialEndsAt" in u)!;
    expect(activation).toMatchObject({ status: "active" });
    expect((activation.trialEndsAt as Date).toISOString().slice(0, 10)).toBe("2026-11-14");
    expect((activation.nextBillingDate as Date).toISOString().slice(0, 10)).toBe("2026-11-14");
    // hasPaid só vira true na 1ª cobrança paga (activateMemberBySubscription).
    expect(activation).not.toHaveProperty("hasPaid");
    expect(h.welcome).toEqual([MEMBER_ID]);
  });

  it("31/01 → 1ª cobrança em 28/02 (sem dia 31 em fevereiro)", async () => {
    h.today = "2026-01-31";
    h.results = [PLAN_PROMO, [], [], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, asaasCardData });
    expect(r.firstChargeDate).toBe("2026-02-28");
    expect(h.subscriptionInputs[0].firstDueDate).toBe("2026-02-28");
  });

  it("31/12 → 1ª cobrança em 31/01 do ano seguinte", async () => {
    h.today = "2026-12-31";
    h.results = [PLAN_PROMO, [], [], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, asaasCardData });
    expect(r.firstChargeDate).toBe("2027-01-31");
  });
});

describe("1º mês grátis — não aplica (cobra normal)", () => {
  it("sem cartão com plano em promoção → recusa antes de consultar o banco, sem assinatura nem gravação", async () => {
    const r = await signupMember(base);
    expect(r).toEqual({ success: false, error: "Informe os dados do cartão." });
    expect(h.dbCalls).toBe(0);
    expect(h.subscriptionInputs).toEqual([]);
    expect(h.inserts).toBe(0);
    expect(h.updates).toEqual([]);
    expect(eligibilityWheres()).toEqual([]);
  });

  it("Mercado Pago com cartão → sem promoção", async () => {
    h.gatewaySlug = "mercadopago";
    h.results = [PLAN_PROMO, [], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, cardTokenId: "tok_mp_1" });
    expect(r.promo).toBeUndefined();
    expect(h.subscriptionInputs[0].firstDueDate).toBeUndefined();
    expect(eligibilityWheres()).toEqual([]);
  });

  it("Asaas com token de cartão (sem dados do cartão) → recusa, sem assinatura nem promoção", async () => {
    h.results = [PLAN_PROMO, [], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, cardTokenId: "tok_1" });
    expect(r).toEqual({ success: false, error: "Informe os dados do cartão." });
    expect(h.subscriptionInputs).toEqual([]);
    expect(h.inserts).toBe(0);
    expect(h.updates).toEqual([]);
    expect(eligibilityWheres()).toEqual([]);
  });

  it("promoção vencida → cobra normal", async () => {
    const vencido = [{ ...PLAN_PROMO[0], promoEndsAt: new Date("2000-01-01T00:00:00Z") }];
    h.results = [vencido, [], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, asaasCardData });
    expect(r.promo).toBeUndefined();
    expect(h.subscriptionInputs[0].firstDueDate).toBeUndefined();
  });

  it("plano sem promoção → cobra normal", async () => {
    h.results = [PLAN_SEM_PROMO, [], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, asaasCardData });
    expect(r.promo).toBeUndefined();
    expect(h.subscriptionInputs[0].firstDueDate).toBeUndefined();
  });
});

describe("1º mês grátis — um por pessoa", () => {
  it("já usada (e-mail ou CPF) e cliente não confirmou → promo_unavailable, sem assinatura nem gravação", async () => {
    h.results = [PLAN_PROMO, [], [{ id: "outro-sócio" }]];
    const r = await signupMember({ ...base, asaasCardData });
    expect(r).toMatchObject({ success: false, code: "promo_unavailable" });
    expect(h.subscriptionInputs).toEqual([]);
    expect(h.inserts).toBe(0);
    expect(h.updates).toEqual([]);
    expect(h.welcome).toEqual([]);
  });

  it("confirmação explícita de cobrança cheia (false) também bloqueia", async () => {
    h.results = [PLAN_PROMO, [], [{ id: "outro-sócio" }]];
    const r = await signupMember({ ...base, asaasCardData, acceptFullPriceIfPromoUnavailable: false });
    expect(r.code).toBe("promo_unavailable");
    expect(h.subscriptionInputs).toEqual([]);
  });

  it("já usada e cliente confirmou → cobra hoje, sem trial, com aviso de promoção usada", async () => {
    h.results = [PLAN_PROMO, [], [{ id: "outro-sócio" }], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, asaasCardData, acceptFullPriceIfPromoUnavailable: true });
    expect(r).toMatchObject({ success: true, promo: "full_price_after_use", paymentMethod: "card" });
    expect(r.firstChargeDate).toBeUndefined();
    expect(h.subscriptionInputs[0].firstDueDate).toBeUndefined();
    expect(h.updates.some((u) => "trialEndsAt" in u)).toBe(false);
    expect(h.updates.some((u) => u.status === "active")).toBe(false);
    expect(h.welcome).toEqual([]);
  });

  it("a elegibilidade cruza e-mail OU CPF e só conta mês grátis ou mensalidade paga", async () => {
    h.results = [PLAN_PROMO, [], [], [{ id: MEMBER_ID }]];
    await signupMember({ ...base, asaasCardData });
    const [q] = eligibilityWheres();
    expect(q).toBeDefined();
    expect(q.sql).toMatch(/"members"\."email"/);
    expect(q.sql).toMatch(/"members"\."cpf"/);
    expect(q.sql).toMatch(/trial_ends_at" is not null/i);
    expect(q.sql).toMatch(/"members"\."has_paid"/);
    expect(q.params).toEqual(expect.arrayContaining(["titular@example.com", "52998224725", true]));
  });
});

describe("1º mês grátis — falhas", () => {
  it("Asaas recusa o cartão → erro amigável, sócio pendente, sem benefício", async () => {
    h.gatewayCreateError = new Error('ASAAS 400 /subscriptions: {"errors":[{"code":"invalid_creditCard"}]}');
    h.results = [PLAN_PROMO, [], [], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, asaasCardData });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/cartão/i);
    expect(r.error).not.toContain("ASAAS");
    expect(h.updates.some((u) => u.status === "active" || "trialEndsAt" in u)).toBe(false);
    expect(h.welcome).toEqual([]);
  });

  it("cartão sem gateway ativo → erro, nunca 'sucesso' pendente", async () => {
    h.gatewayNull = true;
    h.results = [PLAN_SEM_PROMO, []];
    const r = await signupMember({ ...base, asaasCardData });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/cartão/i);
    expect(h.inserts).toBe(0);
  });

  it("limite de tentativas de cartão continua valendo com a promoção", async () => {
    h.rateOk = false;
    const r = await signupMember({ ...base, asaasCardData });
    expect(r.success).toBe(false);
    expect(h.subscriptionInputs).toEqual([]);
    expect(h.dbCalls).toBe(0);
  });
});

describe("1º mês grátis — entrada do cliente", () => {
  it("aceite com tipo errado (payload inválido) é rejeitado antes de tocar o banco", async () => {
    const r = await signupMember({
      ...base,
      asaasCardData,
      acceptFullPriceIfPromoUnavailable: "sim" as unknown as boolean,
    });
    expect(r.success).toBe(false);
    expect(h.dbCalls).toBe(0);
    expect(h.subscriptionInputs).toEqual([]);
  });

  it("método de pagamento enviado pelo cliente (pix) é recusado antes de tocar o banco", async () => {
    const porMethod = await signupMember({ ...base, asaasCardData, method: "pix" } as never);
    const porPaymentMethod = await signupMember({ ...base, asaasCardData, paymentMethod: "pix" } as never);
    for (const r of [porMethod, porPaymentMethod]) {
      expect(r).toEqual({ success: false, error: "A adesão de sócio aceita somente cartão." });
    }
    expect(h.dbCalls).toBe(0);
    expect(h.subscriptionInputs).toEqual([]);
  });

  it("campos de trial/cobrança enviados pelo cliente são ignorados (mass assignment)", async () => {
    h.results = [PLAN_SEM_PROMO, [], [{ id: MEMBER_ID }]];
    const r = await signupMember({
      ...base,
      asaasCardData,
      status: "active",
      trialEndsAt: "2030-01-01",
      hasPaid: true,
      firstDueDate: "2030-01-01",
      firstMonthFree: true,
    } as never);
    expect(r.success).toBe(true);
    expect(r.promo).toBeUndefined();
    expect(h.subscriptionInputs[0].firstDueDate).toBeUndefined();
    expect(h.updates.some((u) => u.status === "active" || "trialEndsAt" in u)).toBe(false);
  });
});
