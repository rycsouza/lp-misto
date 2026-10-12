import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Cancelamento que PRIMEIRO para a cobrança no gateway — se o gateway falhar,
 * nada muda no banco (o sócio não pode achar que cancelou e seguir pagando).
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const h = vi.hoisted(() => ({
  member: null as unknown,
  updates: [] as Record<string, unknown>[],
  gatewaySlug: "asaas",
  gatewayFails: false,
  cancelled: [] as string[],
}));

vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "update"]) chain[m] = () => chain;
  chain.limit = async () => (h.member ? [h.member] : []);
  chain.set = (v: Record<string, unknown>) => {
    h.updates.push(v);
    return { where: async () => [] };
  };
  return { getDb: async () => chain };
});
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/payment/subscription-factory", () => ({
  getSubscriptionGateway: async () => ({
    slug: h.gatewaySlug,
    gateway: {
      cancelSubscription: async (id: string) => {
        if (h.gatewayFails) throw new Error("gateway down");
        h.cancelled.push(id);
        return true;
      },
    },
  }),
}));

import { cancelMembership } from "./cancel";

beforeEach(() => {
  process.env.TICKET_SIGNING_SECRET = "segredo-de-teste-com-tamanho-suficiente";
  h.member = { status: "active", subscriptionId: "sub_1", gatewaySlug: "asaas", nextBillingDate: new Date("2026-11-12") };
  h.updates = [];
  h.gatewaySlug = "asaas";
  h.gatewayFails = false;
  h.cancelled = [];
});

describe("cancelMembership", () => {
  it("ativo → cancela no gateway e mantém benefícios até o fim do período", async () => {
    const r = await cancelMembership(MEMBER_ID);
    expect(h.cancelled).toEqual(["sub_1"]);
    expect(r).toEqual({ ok: true, benefitsUntil: new Date("2026-11-12") });
    expect(h.updates[0]).toMatchObject({ status: "cancelled", nextBillingDate: new Date("2026-11-12") });
  });

  it("gateway falhou → NÃO cancela no banco", async () => {
    h.gatewayFails = true;
    const r = await cancelMembership(MEMBER_ID);
    expect(r).toEqual({ ok: false, error: "gateway_error" });
    expect(h.updates).toEqual([]);
  });

  it("assinatura de outro gateway → não cancela (evita achar que parou de cobrar)", async () => {
    h.gatewaySlug = "mercadopago";
    const r = await cancelMembership(MEMBER_ID);
    expect(r.ok).toBe(false);
    expect(h.updates).toEqual([]);
  });

  it("suspenso → benefícios encerram na hora", async () => {
    h.member = { ...(h.member as object), status: "suspended" };
    const r = await cancelMembership(MEMBER_ID);
    expect(r).toEqual({ ok: true, benefitsUntil: null });
    expect((h.updates[0].nextBillingDate as Date).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("já cancelado → already_cancelled, sem chamar o gateway", async () => {
    h.member = { ...(h.member as object), status: "cancelled" };
    expect(await cancelMembership(MEMBER_ID)).toEqual({ ok: false, error: "already_cancelled" });
    expect(h.cancelled).toEqual([]);
  });
});
