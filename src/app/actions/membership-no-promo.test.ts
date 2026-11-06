import { describe, it, expect, beforeEach, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

/**
 * Sócio-torcedor com cartão, SEM a promoção "1º mês grátis" (removida):
 * - plano ainda marcado com a promoção no banco (legado) cobra hoje, como os demais;
 * - nada de sócio ativo antes do pagamento, nem consulta de elegibilidade;
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

// Plano com a promoção ainda marcada no banco (colunas legadas): não muda nada na adesão.
const PLAN_LEGADO_PROMO = [{ id: PLAN_ID, active: true, name: "Ouro", priceCents: 2990, firstMonthFree: true, promoEndsAt: null }];
const PLAN_SEM_PROMO = [{ ...PLAN_LEGADO_PROMO[0], firstMonthFree: false }];

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

describe("sem 1º mês grátis", () => {
  it("plano marcado com a promoção no banco (legado): cobra hoje, sócio pendente, sem boas-vindas", async () => {
    h.results = [PLAN_LEGADO_PROMO, [], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, asaasCardData });
    expect(r).toMatchObject({ success: true, paymentMethod: "card" });
    expect(r).not.toHaveProperty("promo");
    expect(r).not.toHaveProperty("firstChargeDate");
    expect(h.subscriptionInputs[0].firstDueDate).toBeUndefined();
    expect(h.updates.some((u) => u.status === "active" || "trialEndsAt" in u)).toBe(false);
    expect(h.welcome).toEqual([]);
  });

  it("não consulta elegibilidade de mês grátis (trial_ends_at) no banco", async () => {
    h.results = [PLAN_LEGADO_PROMO, [], [{ id: MEMBER_ID }]];
    await signupMember({ ...base, asaasCardData });
    expect(eligibilityWheres()).toEqual([]);
  });
});

describe("adesão com cartão — falhas", () => {
  it("Asaas recusa o cartão → erro amigável, sócio pendente, sem benefício", async () => {
    h.gatewayCreateError = new Error('ASAAS 400 /subscriptions: {"errors":[{"code":"invalid_creditCard"}]}');
    h.results = [PLAN_SEM_PROMO, [], [{ id: MEMBER_ID }]];
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

  it("limite de tentativas de cartão vale antes de qualquer consulta", async () => {
    h.rateOk = false;
    const r = await signupMember({ ...base, asaasCardData });
    expect(r.success).toBe(false);
    expect(h.subscriptionInputs).toEqual([]);
    expect(h.dbCalls).toBe(0);
  });
});

describe("adesão com cartão — entrada do cliente", () => {
  it("campo antigo de aceite da promoção é ignorado: cobra hoje, normal", async () => {
    h.results = [PLAN_LEGADO_PROMO, [], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, asaasCardData, acceptFullPriceIfPromoUnavailable: true } as never);
    expect(r.success).toBe(true);
    expect(h.subscriptionInputs[0].firstDueDate).toBeUndefined();
  });

  it("método de pagamento enviado pelo cliente (pix) é recusado antes de tocar o banco", async () => {
    const porMethod = await signupMember({ ...base, asaasCardData, method: "pix" } as never);
    const porPaymentMethod = await signupMember({ ...base, asaasCardData, paymentMethod: "pix" } as never);
    for (const r of [porMethod, porPaymentMethod]) {
      expect(r).toEqual({ success: false, error: "A adesão de sócio aceita somente cartão ou Pix Automático." });
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
    expect(r).not.toHaveProperty("promo");
    expect(h.subscriptionInputs[0].firstDueDate).toBeUndefined();
    expect(h.updates.some((u) => u.status === "active" || "trialEndsAt" in u)).toBe(false);
  });
});
