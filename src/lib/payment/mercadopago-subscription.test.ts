import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Assinatura de sócio no Mercado Pago é só cartão: sem o token do Brick não há
 * preapproval (nem o antigo link de redirecionamento). fetch é mockado.
 */
const h = vi.hoisted(() => ({
  calls: [] as { url: string; method: string; body: Record<string, unknown> | null }[],
}));

vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
  h.calls.push({
    url,
    method: init?.method ?? "GET",
    body: init?.body ? JSON.parse(String(init.body)) : null,
  });
  return new Response(JSON.stringify({ id: "preap_1", init_point: "https://mp.example/checkout" }), { status: 200 });
});

import { MercadoPagoSubscriptionClient } from "./mercadopago-subscription";

const input = {
  memberName: "Titular Exemplo",
  memberEmail: "titular@example.com",
  memberPhone: "11900000000",
  cpf: "52998224725",
  externalRef: "member-1",
  planName: "Ouro",
  amountCents: 2990,
};

beforeEach(() => {
  h.calls.length = 0;
});

describe("MercadoPagoSubscriptionClient — assinatura só com cartão", () => {
  it("sem token do cartão: lança sem chamar o Mercado Pago (nada de link de redirecionamento)", async () => {
    const client = new MercadoPagoSubscriptionClient({ accessToken: "test-token" });
    await expect(client.createSubscription(input)).rejects.toThrow("exige o token do cartão");
    expect(h.calls).toEqual([]);
  });

  it("com token do Brick: cria o preapproval com card_token_id, sem initPoint", async () => {
    const client = new MercadoPagoSubscriptionClient({ accessToken: "test-token" });
    const r = await client.createSubscription({ ...input, cardTokenId: "tok_1" });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].body).toMatchObject({ card_token_id: "tok_1", status: "authorized", external_reference: "member-1" });
    expect(r).toEqual({ subscriptionId: "preap_1", paymentMethod: "card" });
    expect("initPoint" in r).toBe(false);
  });
});
