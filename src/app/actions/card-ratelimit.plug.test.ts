import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Regressão anti card-testing: prova que o limite de tentativas com cartão está
 * PLUGADO em todo fluxo público que cobra cartão, e que barra ANTES de tocar o
 * banco/gateway. O banco é um proxy que lança em qualquer uso; o gateway lança
 * se for pedido. PIX não passa pelo limite de cartão.
 */
const h = vi.hoisted(() => ({ allowed: true, calls: 0 }));

vi.mock("@/lib/payment/card-ratelimit", () => ({
  CARD_RATE_LIMIT_ERROR: "LIMITE_CARTAO",
  checkCardAttemptLimit: async () => {
    h.calls++;
    return h.allowed;
  },
}));
vi.mock("@/lib/db/client", () => ({
  getDb: async () =>
    new Proxy(
      {},
      {
        get: (_t, prop) => {
          if (prop === "then") return undefined; // permite o `await getDb()`
          throw new Error("DB_NAO_DEVE_SER_USADO");
        },
      }
    ),
}));
vi.mock("@/lib/payment", () => ({
  getGatewayForMethod: async () => {
    throw new Error("GATEWAY_NAO_DEVE_SER_CHAMADO");
  },
  getActiveGatewayMeta: async () => ({}),
  getPaymentGatewayBySlug: async () => {
    throw new Error("GATEWAY_NAO_DEVE_SER_CHAMADO");
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));

import { createOrder, createProductOrder } from "./checkout";
import { createCantinaOrder } from "./cantina";
import { signupMember } from "./membership";

const buyer = { name: "Torcedor Teste", email: "fan@example.com", whatsapp: "11999990000" };
const asaasCardData = {
  holderName: "TORCEDOR TESTE",
  number: "4000000000000010",
  expiryMonth: "12",
  expiryYear: "2030",
  ccv: "123",
  cpfCnpj: "",
  postalCode: "01001000",
  addressNumber: "1",
};

const CARD_FLOWS = [
  {
    name: "createOrder",
    run: () =>
      createOrder({
        buyer,
        tickets: [{ gameId: "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f", typeCode: "inteira", quantity: 1 }],
        paymentMethod: "credit_card",
        asaasCardData,
      }),
  },
  {
    name: "createProductOrder",
    run: () =>
      createProductOrder({
        buyer,
        items: [{ productId: "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f", quantity: 1 }],
        paymentMethod: "credit_card",
        asaasCardData,
      } as Parameters<typeof createProductOrder>[0]),
  },
  {
    name: "createCantinaOrder",
    run: () =>
      createCantinaOrder({
        buyer,
        items: [{ itemId: "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f", quantity: 1 }],
        paymentMethod: "credit_card",
        asaasCardData,
      }),
  },
  {
    name: "signupMember",
    run: () =>
      signupMember({
        name: "Torcedor Teste",
        email: "fan@example.com",
        whatsapp: "11999990000",
        cpf: "52998224725",
        planId: "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f",
        asaasCardData: {
          holderName: "TORCEDOR TESTE",
          number: "4000000000000010",
          expiryMonth: "12",
          expiryYear: "2030",
          ccv: "123",
          postalCode: "01001000",
          addressNumber: "1",
        },
      }),
  },
];

beforeEach(() => {
  h.allowed = true;
  h.calls = 0;
});

describe("limite de tentativas com cartão está plugado nos fluxos públicos", () => {
  for (const { name, run } of CARD_FLOWS) {
    it(`${name} barra com cartão quando o limite estoura (antes do banco/gateway)`, async () => {
      h.allowed = false;
      const r = await run();
      expect(r.success).toBe(false);
      expect(r.error).toBe("LIMITE_CARTAO");
      expect(h.calls).toBe(1);
    });
  }

  it("createOrder com PIX não consome o limite de cartão", async () => {
    h.allowed = false;
    const r = await createOrder({
      buyer,
      tickets: [{ gameId: "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f", typeCode: "inteira", quantity: 1 }],
      paymentMethod: "pix",
    }).catch((e: Error) => ({ success: false, error: e.message }));
    expect(h.calls).toBe(0);
    expect(r.error).not.toBe("LIMITE_CARTAO");
  });

  it("honeypot preenchido continua barrando antes do limite", async () => {
    const r = await createOrder({
      buyer,
      tickets: [],
      paymentMethod: "credit_card",
      asaasCardData,
      _hp: "bot",
    });
    expect(r.success).toBe(false);
    expect(h.calls).toBe(0);
  });
});
