import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Webhook genérico de pagamento: cobrança de ASSINATURA não existe na tabela
 * payments — deve ser encaminhada para a sincronização do sócio (que reconsulta
 * o gateway), para funcionar qualquer que seja a URL configurada no Asaas.
 */
const h = vi.hoisted(() => ({ paymentRows: [] as unknown[], synced: [] as string[], applied: 0 }));

vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where"]) chain[m] = () => chain;
  chain.limit = async () => h.paymentRows;
  return { getDb: async () => chain };
});
vi.mock("@/lib/payment", () => ({
  getPaymentGatewayBySlug: async () => ({ getPaymentStatus: async () => "paid" }),
}));
vi.mock("@/lib/payment/sync", () => ({
  applyGatewayStatus: async () => {
    h.applied++;
  },
}));
vi.mock("@/lib/membership/sync", () => ({
  syncMemberSubscription: async (id: string) => {
    h.synced.push(id);
    return "active";
  },
}));

import { POST } from "./route";
import type { NextRequest } from "next/server";

function req(body: unknown): NextRequest {
  return new Request("https://clube.example/api/webhooks/payment", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  h.paymentRows = [];
  h.synced = [];
  h.applied = 0;
});

describe("POST /api/webhooks/payment", () => {
  it("cobrança de assinatura (fora de payments) → sincroniza o sócio", async () => {
    const res = await POST(
      req({ event: "PAYMENT_CONFIRMED", payment: { id: "pay_9", status: "CONFIRMED", subscription: "sub_1" } })
    );
    expect(res.status).toBe(200);
    expect(h.synced).toEqual(["sub_1"]);
    expect(h.applied).toBe(0);
  });

  it("cobrança avulsa conhecida → segue o fluxo de pedido (reconsulta o gateway)", async () => {
    h.paymentRows = [{ id: "p1", orderId: "o1", gatewaySlug: "asaas" }];
    await POST(req({ event: "PAYMENT_CONFIRMED", payment: { id: "pay_1", status: "CONFIRMED" } }));
    expect(h.applied).toBe(1);
    expect(h.synced).toEqual([]);
  });

  it("cobrança desconhecida sem assinatura → ignorada", async () => {
    const res = await POST(req({ event: "PAYMENT_CONFIRMED", payment: { id: "pay_x", status: "CONFIRMED" } }));
    expect(res.status).toBe(200);
    expect(h.synced).toEqual([]);
    expect(h.applied).toBe(0);
  });
});
