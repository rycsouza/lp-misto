import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Regressão: adesão de sócio com CARTÃO não pode responder "sucesso" quando o
 * gateway falha (recusa, falta de permissão, rede). Antes, o erro caía no modo
 * "ativação manual" e a tela mostrava "concluído" sem pagamento.
 */
const h = vi.hoisted(() => ({
  results: [] as unknown[],
  gatewayError: null as Error | null,
  subscriptionCalls: 0,
}));

// Banco falso encadeável: cada `await` de uma query devolve o próximo resultado da fila.
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
  return { select: () => chain, insert: () => chain, update: () => chain };
}

vi.mock("@/lib/db/client", () => ({ getDb: async () => fakeDb() }));
vi.mock("@/lib/payment/card-ratelimit", () => ({
  CARD_RATE_LIMIT_ERROR: "LIMITE",
  checkCardAttemptLimit: async () => true,
}));
vi.mock("@/lib/payment/subscription-factory", () => ({
  getSubscriptionGateway: async () => ({
    slug: "asaas",
    gateway: {
      createSubscription: async () => {
        h.subscriptionCalls++;
        if (h.gatewayError) throw h.gatewayError;
        return { gatewayCustomerId: "cus_1", subscriptionId: "sub_1", paymentMethod: "card" };
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

beforeEach(() => {
  h.gatewayError = null;
  h.subscriptionCalls = 0;
  // plano ativo → sem sócio existente → insert do sócio
  h.results = [[{ id: base.planId, active: true, name: "Ouro", priceCents: 2990 }], [], [{ id: "member-1" }]];
});

describe("signupMember com cartão", () => {
  it("cartão recusado/negado no gateway → success:false (não mostra 'concluído')", async () => {
    h.gatewayError = new Error('ASAAS 400 /subscriptions: {"errors":[{"code":"invalid_creditCard"}]}');
    const r = await signupMember({ ...base, asaasCardData });
    expect(h.subscriptionCalls).toBe(1);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/cartão/i);
    // A mensagem ao usuário não vaza o detalhe interno do gateway.
    expect(r.error).not.toContain("ASAAS");
  });

  it("falta de permissão (403) também não vira sucesso", async () => {
    h.gatewayError = new Error("ASAAS 403 /subscriptions: forbidden");
    const r = await signupMember({ ...base, asaasCardData });
    expect(r.success).toBe(false);
  });

  it("cartão aprovado continua retornando sucesso com método 'card'", async () => {
    const r = await signupMember({ ...base, asaasCardData });
    expect(r).toMatchObject({ success: true, memberId: "member-1", paymentMethod: "card" });
  });
});
