import { describe, it, expect, beforeEach, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

/**
 * Sócio-torcedor — plano EMPRESARIAL (pj, CNPJ):
 * - o público vem do PLANO escolhido no servidor (nunca de flag do client);
 * - exige CNPJ válido (dígitos verificadores) e razão social; ignora CPF;
 * - grava cnpj/company_name e cpf NULL; o gateway recebe o CNPJ (e o nome da empresa);
 * - 1º mês grátis: um por pessoa/empresa, cruzando e-mail OU CNPJ;
 * - mural: com opt-in, aparece a razão social (não o nome do responsável).
 * - plano de CPF (pf) continua igual: CPF, sem CNPJ.
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const PLAN_ID = "1b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const CNPJ = "11.222.333/0001-81";
const CNPJ_DIGITS = "11222333000181";

const h = vi.hoisted(() => ({
  results: [] as unknown[],
  updates: [] as Record<string, unknown>[],
  inserted: [] as Record<string, unknown>[],
  wheres: [] as unknown[],
  dbCalls: 0,
  today: "2026-10-14",
  rateOk: true,
  subscriptionInputs: [] as Record<string, unknown>[],
  welcome: [] as string[],
}));

// Banco falso: cada `await` consome o próximo item de `h.results` (vazio → []).
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
      if (prop === "values") {
        return (v: Record<string, unknown>) => {
          h.inserted.push(v);
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
  return { select: () => chain, insert: () => chain, update: () => chain };
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
  getSubscriptionGateway: async () => ({
    slug: "asaas",
    gateway: {
      cancelSubscription: async () => true,
      createSubscription: async (input: Record<string, unknown>) => {
        h.subscriptionInputs.push(input);
        return {
          gatewayCustomerId: "cus_1",
          subscriptionId: "sub_1",
          paymentMethod: "card",
          nextDueDate: input.firstDueDate,
        };
      },
    },
  }),
}));
vi.mock("@/lib/email", () => ({
  sendMemberWelcomeEmail: async (id: string) => {
    h.welcome.push(id);
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { signupMember } from "./membership";

const PLAN_PJ = { id: PLAN_ID, active: true, name: "Empresarial", priceCents: 24900, audience: "pj", firstMonthFree: false, promoEndsAt: null };
const PLAN_PJ_PROMO = { ...PLAN_PJ, firstMonthFree: true };
const PLAN_PF = { ...PLAN_PJ, name: "Carcará", priceCents: 4990, audience: "pf" };

const asaasCardData = {
  holderName: "RESPONSAVEL EXEMPLO",
  number: "4000000000000010",
  expiryMonth: "12",
  expiryYear: "2030",
  ccv: "123",
  postalCode: "01001000",
  addressNumber: "1",
};

const base = {
  name: "Responsável Exemplo",
  email: "responsavel@example.com",
  whatsapp: "11900000000",
  planId: PLAN_ID,
};

/** Consultas com WHERE que tocam a elegibilidade do 1º mês grátis. */
function eligibilityWheres(): { sql: string; params: unknown[] }[] {
  const dialect = new PgDialect();
  return h.wheres
    .map((w) => dialect.sqlToQuery(w as never))
    .filter((q) => q.sql.includes("trial_ends_at"));
}

beforeEach(() => {
  h.results = [];
  h.updates = [];
  h.inserted = [];
  h.wheres = [];
  h.dbCalls = 0;
  h.today = "2026-10-14";
  h.rateOk = true;
  h.subscriptionInputs = [];
  h.welcome = [];
});

describe("plano empresarial (CNPJ) — adesão", () => {
  it("CNPJ válido + razão social → sócio pendente, gateway recebe o CNPJ e o nome da empresa, sem CPF", async () => {
    h.results = [[PLAN_PJ], [], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, cnpj: CNPJ, companyName: "Padaria Bom Pão Ltda", asaasCardData });

    expect(r).toMatchObject({ success: true, memberId: MEMBER_ID, paymentMethod: "card" });
    const input = h.subscriptionInputs[0];
    expect(input).toMatchObject({
      cnpj: CNPJ_DIGITS,
      companyName: "Padaria Bom Pão Ltda",
      memberName: "Responsável Exemplo",
    });
    expect(input).not.toHaveProperty("cpf");
    expect(h.inserted[0]).toMatchObject({
      name: "Responsável Exemplo",
      cnpj: CNPJ_DIGITS,
      companyName: "Padaria Bom Pão Ltda",
      cpf: null,
      wallName: null,
    });
  });

  it("CNPJ inválido (dígito verificador) → recusa antes de gravar e de cobrar", async () => {
    h.results = [[PLAN_PJ]];
    const r = await signupMember({ ...base, cnpj: "11.222.333/0001-82", companyName: "Padaria Bom Pão", asaasCardData });
    expect(r).toEqual({ success: false, error: "Informe um CNPJ válido." });
    expect(h.inserted).toEqual([]);
    expect(h.updates).toEqual([]);
    expect(h.subscriptionInputs).toEqual([]);
  });

  it("CNPJ ausente ou com sequência repetida → recusa", async () => {
    for (const cnpj of [undefined, "00000000000000", "11111111111111", "123"]) {
      h.results = [[PLAN_PJ]];
      const r = await signupMember({ ...base, cnpj, companyName: "Padaria Bom Pão", asaasCardData });
      expect(r, String(cnpj)).toEqual({ success: false, error: "Informe um CNPJ válido." });
    }
    expect(h.inserted).toEqual([]);
    expect(h.subscriptionInputs).toEqual([]);
  });

  it("razão social obrigatória: vazia ou com 1 caractere → recusa", async () => {
    for (const companyName of [undefined, "", "A"]) {
      h.results = [[PLAN_PJ]];
      const r = await signupMember({ ...base, cnpj: CNPJ, companyName, asaasCardData });
      expect(r.success, String(companyName)).toBe(false);
      expect(r.error).toMatch(/^Nome da empresa: /);
    }
    expect(h.inserted).toEqual([]);
  });

  it("razão social com HTML ou link → recusa (barreira de conteúdo, mesmo sem mural)", async () => {
    h.results = [[PLAN_PJ]];
    const r = await signupMember({ ...base, cnpj: CNPJ, companyName: "<img src=x onerror=alert(1)>", asaasCardData });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/^Nome da empresa: /);
    expect(h.inserted).toEqual([]);
  });

  it("CPF enviado no plano empresarial é IGNORADO (não exige nem valida CPF, não vai ao gateway)", async () => {
    h.results = [[PLAN_PJ], [], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, cpf: "12345678900", cnpj: CNPJ, companyName: "Padaria Bom Pão", asaasCardData });
    expect(r.success).toBe(true);
    expect(h.subscriptionInputs[0]).not.toHaveProperty("cpf");
    expect(h.inserted[0]).toMatchObject({ cpf: null, cnpj: CNPJ_DIGITS });
  });

  it("sem CPF no cadastro não pede CPF no plano empresarial (não consulta o CPF do cliente)", async () => {
    h.results = [[PLAN_PJ], [], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, cnpj: CNPJ, companyName: "Padaria Bom Pão", asaasCardData });
    expect(r.success).toBe(true);
    // Só plano, sócio existente e insert: a fila foi consumida sem consulta extra de CPF.
    expect(h.results).toEqual([]);
  });

  it("o público vem do plano: campos de tipo/documento enviados pelo client são ignorados", async () => {
    h.results = [[PLAN_PF], [], [{ id: MEMBER_ID }]];
    // Plano de CPF + CNPJ enviado: o CNPJ é ignorado e o CPF é exigido.
    const r = await signupMember({
      ...base,
      cnpj: CNPJ,
      companyName: "Padaria Bom Pão",
      audience: "pj",
      asaasCardData,
    } as never);
    expect(r).toEqual({ success: false, error: "Informe o CPF." });
    expect(h.inserted).toEqual([]);
    expect(h.subscriptionInputs).toEqual([]);
  });

  it("mural com opt-in: aparece a razão social (não o nome do responsável)", async () => {
    h.results = [[PLAN_PJ], [], [{ id: MEMBER_ID }]];
    const r = await signupMember({
      ...base,
      cnpj: CNPJ,
      companyName: "  Padaria  Bom Pão & Filhos Ltda ",
      wallOptIn: true,
      asaasCardData,
    });
    expect(r.success).toBe(true);
    expect(h.inserted[0]).toMatchObject({
      name: "Responsável Exemplo",
      wallName: "Padaria Bom Pão & Filhos Ltda",
    });
  });
});

describe("plano empresarial — 1º mês grátis por CNPJ (um por pessoa/empresa)", () => {
  it("CNPJ já usado por outro cadastro → promo_unavailable, sem assinatura nem gravação", async () => {
    h.results = [[PLAN_PJ_PROMO], [], [{ id: "outra-empresa" }]];
    const r = await signupMember({ ...base, cnpj: CNPJ, companyName: "Padaria Bom Pão", asaasCardData });
    expect(r).toMatchObject({ success: false, code: "promo_unavailable" });
    expect(h.subscriptionInputs).toEqual([]);
    expect(h.inserted).toEqual([]);
  });

  it("a elegibilidade cruza e-mail OU CNPJ (sem CPF na consulta)", async () => {
    h.results = [[PLAN_PJ_PROMO], [], [], [{ id: MEMBER_ID }]];
    await signupMember({ ...base, cnpj: CNPJ, companyName: "Padaria Bom Pão", asaasCardData });
    const [q] = eligibilityWheres();
    expect(q).toBeDefined();
    expect(q.sql).toMatch(/"members"\."email"/);
    expect(q.sql).toMatch(/"members"\."cnpj"/);
    expect(q.sql).not.toMatch(/"members"\."cpf"/);
    expect(q.params).toEqual(expect.arrayContaining(["responsavel@example.com", CNPJ_DIGITS, true]));
  });

  it("CNPJ sem uso anterior → 1º mês grátis aplicado (1ª cobrança no mesmo dia do mês seguinte)", async () => {
    h.results = [[PLAN_PJ_PROMO], [], [], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, cnpj: CNPJ, companyName: "Padaria Bom Pão", asaasCardData });
    expect(r).toMatchObject({ success: true, promo: "applied", firstChargeDate: "2026-11-14" });
    expect(h.subscriptionInputs[0].firstDueDate).toBe("2026-11-14");
    expect(h.welcome).toEqual([MEMBER_ID]);
  });
});

describe("plano de pessoa física (CPF) — continua igual", () => {
  it("grava CPF e deixa cnpj/company_name vazios; gateway recebe só o CPF", async () => {
    h.results = [[PLAN_PF], [], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, cpf: "52998224725", asaasCardData });
    expect(r.success).toBe(true);
    expect(h.subscriptionInputs[0]).toMatchObject({ cpf: "52998224725" });
    expect(h.subscriptionInputs[0]).not.toHaveProperty("cnpj");
    expect(h.inserted[0]).toMatchObject({ cpf: "52998224725", cnpj: null, companyName: null });
  });

  it("CNPJ enviado num plano de CPF não muda nada (é ignorado)", async () => {
    h.results = [[PLAN_PF], [], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, cpf: "52998224725", cnpj: CNPJ, companyName: "Padaria", asaasCardData });
    expect(r.success).toBe(true);
    expect(h.inserted[0]).toMatchObject({ cnpj: null, companyName: null });
  });
});
