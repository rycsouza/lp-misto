import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Adesão com Pix Automático (endpoint público): só com a opção ligada pelo admin do sistema e
 * gateway Asaas; sem cartão no payload; limite de tentativas; sem mês grátis; o sócio fica
 * pendente (ativação só pelo gateway) e a resposta traz só o QR.
 */
const h = vi.hoisted(() => ({
  results: [] as unknown[],
  slug: "asaas",
  enabled: "true" as unknown,
  rateOk: true,
  authCalls: [] as Record<string, unknown>[],
  subscriptionCalls: 0,
  gatewayError: null as Error | null,
  updates: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
}));

function fakeDb(): unknown {
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, prop) => {
      if (prop === "then") {
        const value = h.results.length ? h.results.shift() : [];
        return (resolve: (v: unknown) => void) => resolve(value);
      }
      return () => chain;
    },
    apply: () => chain,
  });
  return {
    select: () => chain,
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        h.inserts.push(v);
        return chain;
      },
    }),
    update: () => ({
      set: (v: Record<string, unknown>) => {
        h.updates.push(v);
        return chain;
      },
    }),
  };
}

vi.mock("@/lib/db/client", () => ({ getDb: async () => fakeDb() }));
vi.mock("@/lib/payment/card-ratelimit", () => ({
  CARD_RATE_LIMIT_ERROR: "LIMITE",
  MEMBER_CARD_RATE_LIMIT_ERROR: "LIMITE",
  checkCardAttemptLimit: async () => true,
}));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: async () => ({ ok: h.rateOk }) }));
vi.mock("@/lib/config", () => ({
  getSiteConfig: async () => ({ membershipPixAutomaticEnabled: h.enabled, membershipProgramName: "Sócio Carcará" }),
}));
vi.mock("@/lib/payment/subscription-factory", () => ({
  getSubscriptionGateway: async () => ({
    slug: h.slug,
    gateway: {
      createSubscription: async () => {
        h.subscriptionCalls++;
        return { gatewayCustomerId: "cus_1", subscriptionId: "sub_1", paymentMethod: "card" };
      },
      createPixAutomaticAuthorization: async (input: Record<string, unknown>) => {
        h.authCalls.push(input);
        if (h.gatewayError) throw h.gatewayError;
        return {
          gatewayCustomerId: "cus_1",
          authorizationId: "auth_1",
          qrPayload: "000201PIX",
          qrImageBase64: "iVBORw0KGgo=",
          expiresAt: "2026-11-06T13:00:00Z",
        };
      },
    },
  }),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { signupMember } from "./membership";

const base = {
  name: "Titular Exemplo",
  email: "titular@example.com",
  whatsapp: "11900000000",
  cpf: "52998224725",
  planId: "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f",
  paymentMethod: "pix_automatic" as const,
};
const PLAN = [{ id: base.planId, active: true, name: "Ouro", priceCents: 2990, promoFirstMonthFree: true, audience: "pf" }];

beforeEach(() => {
  h.slug = "asaas";
  h.enabled = "true";
  h.rateOk = true;
  h.authCalls = [];
  h.subscriptionCalls = 0;
  h.gatewayError = null;
  h.updates = [];
  h.inserts = [];
  // plano ativo → sem sócio existente → insert do sócio
  h.results = [PLAN, [], [{ id: "member-1" }]];
});

describe("signupMember com Pix Automático", () => {
  it("cria a autorização (sem cartão, sem mês grátis) e devolve só o QR; sócio fica pendente", async () => {
    const r = await signupMember(base);
    expect(r).toMatchObject({
      success: true,
      memberId: "member-1",
      paymentMethod: "pix_automatic",
      pix: { payload: "000201PIX", imageBase64: "iVBORw0KGgo=", expiresAt: "2026-11-06T13:00:00Z" },
    });
    expect(r).not.toHaveProperty("promo");
    expect(h.subscriptionCalls).toBe(0);
    expect(h.authCalls).toHaveLength(1);
    const input = h.authCalls[0];
    expect(input).toMatchObject({ amountCents: 2990, planName: "Ouro", cpf: "52998224725", expirationSeconds: 3600 });
    expect(String(input.contractId).length).toBeLessThanOrEqual(35);
    expect(input).not.toHaveProperty("asaasCardData");
    // Cadastro pendente com a forma de pagamento; o vínculo da autorização é gravado depois.
    expect(h.inserts[0]).toMatchObject({ status: "pending", paymentMethod: "pix_automatic" });
    expect(h.updates.at(-1)).toMatchObject({ pixAutomaticAuthorizationId: "auth_1", paymentMethod: "pix_automatic" });
    expect(h.updates.some((u) => u.status === "active" || "trialEndsAt" in u)).toBe(false);
  });

  it("opção desligada pelo admin do sistema: recusa sem criar autorização", async () => {
    h.enabled = "false";
    const r = await signupMember(base);
    expect(r).toEqual({ success: false, error: "Pix Automático indisponível no momento. Assine com cartão." });
    expect(h.authCalls).toEqual([]);
  });

  it("gateway que não é Asaas: recusa", async () => {
    h.slug = "mercadopago";
    const r = await signupMember(base);
    expect(r.success).toBe(false);
    expect(h.authCalls).toEqual([]);
  });

  it("Pix Automático com dados de cartão junto: recusa antes de tocar o banco", async () => {
    const filaAntes = h.results.length;
    const r = await signupMember({
      ...base,
      asaasCardData: {
        holderName: "X",
        number: "4000000000000010",
        expiryMonth: "12",
        expiryYear: "2030",
        ccv: "123",
        postalCode: "01001000",
        addressNumber: "1",
      },
    });
    expect(r).toEqual({ success: false, error: "A adesão de sócio aceita somente cartão ou Pix Automático." });
    expect(h.results).toHaveLength(filaAntes);
    expect(h.authCalls).toEqual([]);
  });

  it("Pix comum (não automático) continua recusado", async () => {
    const r = await signupMember({ ...base, paymentMethod: "pix" } as never);
    expect(r).toEqual({ success: false, error: "A adesão de sócio aceita somente cartão ou Pix Automático." });
    expect(h.authCalls).toEqual([]);
  });

  it("muitas tentativas: recusa sem criar autorização", async () => {
    h.rateOk = false;
    const r = await signupMember(base);
    expect(r).toEqual({
      success: false,
      error: "Muitas tentativas de Pix Automático. Aguarde alguns minutos e tente de novo.",
    });
    expect(h.authCalls).toEqual([]);
  });

  it("falha no gateway: erro genérico (sem detalhe do gateway), sócio não é ativado", async () => {
    h.gatewayError = new Error("ASAAS 400: cpfCnpj 529.982.247-25 inválido");
    const r = await signupMember(base);
    expect(r).toEqual({
      success: false,
      error: "Não foi possível gerar o Pix Automático agora. Tente de novo em instantes ou assine com cartão.",
    });
    expect(JSON.stringify(r)).not.toContain("529");
    expect(h.updates.some((u) => u.status === "active")).toBe(false);
  });
});
