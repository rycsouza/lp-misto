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
  lastSubscriptionInput: null as Record<string, unknown> | null,
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
  MEMBER_CARD_RATE_LIMIT_ERROR: "LIMITE",
  checkCardAttemptLimit: async () => true,
}));
vi.mock("@/lib/payment/subscription-factory", () => ({
  getSubscriptionGateway: async () => ({
    slug: "asaas",
    gateway: {
      createSubscription: async (input: Record<string, unknown>) => {
        h.subscriptionCalls++;
        h.lastSubscriptionInput = input;
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
  h.lastSubscriptionInput = null;
  // plano ativo → sem sócio existente → insert do sócio
  h.results = [[{ id: base.planId, active: true, name: "Ouro", priceCents: 2990 }], [], [{ id: "member-1" }]];
});

describe("signupMember — só cartão (sócio nunca paga por PIX)", () => {
  it("sem cardTokenId e sem asaasCardData → 'Informe os dados do cartão.', sem consultar, assinar ou gravar", async () => {
    const filaAntes = h.results.length;
    const r = await signupMember({ ...base });
    expect(r).toEqual({ success: false, error: "Informe os dados do cartão." });
    expect(h.subscriptionCalls).toBe(0);
    // Nenhuma query foi feita: a fila de resultados continua intacta (nada foi lido nem gravado).
    expect(h.results).toHaveLength(filaAntes);
  });

  it("payload com método pix é recusado, mesmo levando dados de cartão", async () => {
    const r = await signupMember({ ...base, asaasCardData, method: "pix" } as never);
    expect(r).toEqual({ success: false, error: "A adesão de sócio aceita somente cartão." });
    expect(h.subscriptionCalls).toBe(0);
  });

  it("paymentMethod pix é recusado, mesmo levando dados de cartão", async () => {
    const r = await signupMember({ ...base, asaasCardData, paymentMethod: "pix" } as never);
    expect(r).toEqual({ success: false, error: "A adesão de sócio aceita somente cartão." });
    expect(h.subscriptionCalls).toBe(0);
  });

  it("Asaas com token do Brick (sem dados do cartão) → recusa sem criar assinatura", async () => {
    const r = await signupMember({ ...base, cardTokenId: "tok_mp_1" });
    expect(r).toEqual({ success: false, error: "Informe os dados do cartão." });
    expect(h.subscriptionCalls).toBe(0);
    expect(h.lastSubscriptionInput).toBeNull();
  });
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

describe("signupMember — CPF do cadastro (cliente recorrente)", () => {
  const STORED_CPF = "11144477735"; // CPF fictício válido (dígito verificador)
  const PLAN = [{ id: base.planId, active: true, name: "Ouro", priceCents: 2990 }];
  const { cpf: _omit, ...semCpf } = base;
  void _omit;

  it("sem CPF informado, usa o CPF salvo no cadastro (resolvido no servidor)", async () => {
    // 1ª query: CPF do cliente pelo WhatsApp → depois plano, sócio existente, insert
    h.results = [[{ cpf: STORED_CPF }], PLAN, [], [{ id: "member-1" }]];
    const r = await signupMember({ ...semCpf, asaasCardData });
    expect(r.success).toBe(true);
    expect(h.lastSubscriptionInput?.cpf).toBe(STORED_CPF);
  });

  it("CPF informado vence o do cadastro", async () => {
    h.results = [PLAN, [], [{ id: "member-1" }]];
    const r = await signupMember({ ...base, asaasCardData });
    expect(r.success).toBe(true);
    expect(h.lastSubscriptionInput?.cpf).toBe(base.cpf);
  });

  it("sem CPF informado e sem CPF no cadastro → erro, sem criar sócio nem assinatura", async () => {
    h.results = [[]];
    const r = await signupMember({ ...semCpf, asaasCardData });
    expect(r).toMatchObject({ success: false, error: "Informe o CPF." });
    expect(h.subscriptionCalls).toBe(0);
  });

  it("CPF informado inválido continua rejeitado", async () => {
    const r = await signupMember({ ...base, cpf: "12345678900", asaasCardData });
    expect(r.success).toBe(false);
    expect(h.subscriptionCalls).toBe(0);
  });

  it("CPF inválido salvo no cadastro não é usado", async () => {
    h.results = [[{ cpf: "00000000000" }]];
    const r = await signupMember({ ...semCpf, asaasCardData });
    expect(r).toMatchObject({ success: false, error: "Informe o CPF." });
  });
});

describe("signupMember — nome/e-mail do cadastro (lookup só devolve mascarado)", () => {
  it("sem nome/e-mail, completa pelo cadastro do WhatsApp no servidor", async () => {
    // 1ª query: identidade pelo WhatsApp → plano → sócio existente → insert
    h.results = [
      [{ name: "Titular Cadastrado", email: "cadastro@example.com" }],
      [{ id: base.planId, active: true, name: "Ouro", priceCents: 2990 }],
      [],
      [{ id: "member-1" }],
    ];
    const r = await signupMember({ ...base, name: "", email: "", asaasCardData });
    expect(r.success).toBe(true);
    expect(h.lastSubscriptionInput).toMatchObject({
      memberName: "Titular Cadastrado",
      memberEmail: "cadastro@example.com",
    });
  });

  it("sem nome/e-mail e sem cadastro → dados inválidos, sem assinatura", async () => {
    h.results = [[]];
    const r = await signupMember({ ...base, name: "", email: "", asaasCardData });
    expect(r.success).toBe(false);
    expect(h.subscriptionCalls).toBe(0);
  });
});
