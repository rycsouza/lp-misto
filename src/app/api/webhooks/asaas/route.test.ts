import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Webhook de assinatura (Asaas): fail-closed no token, aceita o token salvo no
 * gateway do clube (multi-tenant) ou o do env, e ativa via sincronização com o
 * gateway — nunca pelo status do corpo.
 */
const h = vi.hoisted(() => ({
  gatewayToken: null as string | null,
  synced: [] as string[],
  cancelled: [] as { id: string; immediate?: boolean }[],
}));

vi.mock("@/lib/payment", () => ({
  getActiveGatewayWebhookSecret: async () => h.gatewayToken,
}));
vi.mock("@/lib/membership/sync", () => ({
  syncMemberSubscription: async (id: string) => {
    h.synced.push(id);
    return "active";
  },
}));
vi.mock("@/lib/membership/subscription", () => ({
  cancelMemberBySubscription: async (id: string, opts?: { immediate?: boolean }) => {
    h.cancelled.push({ id, immediate: opts?.immediate });
  },
}));

import { POST } from "./route";
import type { NextRequest } from "next/server";

function req(body: unknown, token?: string): NextRequest {
  return new Request("https://clube.example/api/webhooks/asaas", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { "asaas-access-token": token } : {}) },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const confirmed = { event: "PAYMENT_CONFIRMED", payment: { id: "pay_1", subscription: "sub_1", status: "CONFIRMED" } };

beforeEach(() => {
  h.gatewayToken = "token-do-gateway";
  h.synced = [];
  h.cancelled = [];
  delete process.env.ASAAS_WEBHOOK_TOKEN;
});

describe("POST /api/webhooks/asaas", () => {
  it("sem token → 401 e nada é processado", async () => {
    const res = await POST(req(confirmed));
    expect(res.status).toBe(401);
    expect(h.synced).toEqual([]);
  });

  it("token errado → 401", async () => {
    const res = await POST(req(confirmed, "token-errado"));
    expect(res.status).toBe(401);
    expect(h.synced).toEqual([]);
  });

  it("nenhum token configurado (gateway nem env) → 401 (fail-closed)", async () => {
    h.gatewayToken = null;
    const res = await POST(req(confirmed, "qualquer"));
    expect(res.status).toBe(401);
  });

  it("aceita o token salvo no gateway do clube e sincroniza a assinatura", async () => {
    const res = await POST(req(confirmed, "token-do-gateway"));
    expect(res.status).toBe(200);
    expect(h.synced).toEqual(["sub_1"]);
  });

  it("segue aceitando o token do env (compatibilidade)", async () => {
    process.env.ASAAS_WEBHOOK_TOKEN = "token-do-env";
    const res = await POST(req(confirmed, "token-do-env"));
    expect(res.status).toBe(200);
    expect(h.synced).toEqual(["sub_1"]);
  });

  it("PAYMENT_RECEIVED também sincroniza", async () => {
    await POST(req({ ...confirmed, event: "PAYMENT_RECEIVED" }, "token-do-gateway"));
    expect(h.synced).toEqual(["sub_1"]);
  });

  it("evento sem assinatura (cobrança avulsa) é ignorado", async () => {
    const res = await POST(req({ event: "PAYMENT_CONFIRMED", payment: { id: "pay_2" } }, "token-do-gateway"));
    expect(res.status).toBe(200);
    expect(h.synced).toEqual([]);
  });

  it("estorno cancela o sócio NA HORA", async () => {
    await POST(req({ event: "PAYMENT_REFUNDED", payment: { subscription: "sub_1" } }, "token-do-gateway"));
    expect(h.cancelled).toEqual([{ id: "sub_1", immediate: true }]);
  });

  it("mensalidade vencida reconsulta o gateway (carência decide a suspensão)", async () => {
    await POST(req({ event: "PAYMENT_OVERDUE", payment: { subscription: "sub_1" } }, "token-do-gateway"));
    expect(h.synced).toEqual(["sub_1"]);
    expect(h.cancelled).toEqual([]);
  });

  it("assinatura removida no gateway (subscription.id) → cancela mantendo o período", async () => {
    await POST(req({ event: "SUBSCRIPTION_DELETED", subscription: { id: "sub_1" } }, "token-do-gateway"));
    expect(h.cancelled).toEqual([{ id: "sub_1", immediate: undefined }]);
  });
});
