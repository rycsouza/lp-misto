import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Ativação por pagamento confirmado grava has_paid = true (histórico exigido pelo
 * 1º mês grátis: quem já pagou alguma vez não ganha o mês de novo). Cancelamento
 * e suspensão NÃO mexem nesse histórico.
 */
const h = vi.hoisted(() => ({
  results: [] as unknown[],
  updates: [] as Record<string, unknown>[],
}));

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
      return () => chain;
    },
    apply: () => chain,
  });
  return { select: () => chain, update: () => chain };
}

vi.mock("@/lib/db/client", () => ({ getDb: async () => fakeDb() }));
vi.mock("@/lib/email", () => ({ sendMemberWelcomeEmail: async () => true }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { activateMemberBySubscription, suspendMemberBySubscription } from "./subscription";

beforeEach(() => {
  h.results = [];
  h.updates = [];
});

describe("activateMemberBySubscription", () => {
  it("grava hasPaid: true junto com a ativação", async () => {
    h.results = [[{ status: "pending" }], [{ id: "m1" }], []];
    await activateMemberBySubscription("sub_1", new Date("2026-11-14T00:00:00Z"));
    const activation = h.updates[0];
    expect(activation).toMatchObject({ status: "active", hasPaid: true });
  });

  it("não é ativação paga quando a suspensão roda: hasPaid fica fora do update", async () => {
    await suspendMemberBySubscription("sub_1");
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0]).toEqual({ status: "suspended" });
    expect(h.updates[0]).not.toHaveProperty("hasPaid");
  });
});
