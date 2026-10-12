import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Portaria: o id do PEDIDO só vale como entrada em pedidos antigos, sem
 * ingressos individuais. Com ingressos, entrar pelo pedido permitia dupla
 * entrada (pedido + cada ingresso) — e o id do pedido aparece em telas.
 */
const ORDER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const GAME_ID = "2b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";

const h = vi.hoisted(() => ({ results: [] as unknown[] }));

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
  // O db em si não pode ser "thenable" (o `await getDb()` consumiria a fila).
  return { select: () => chain, insert: () => chain, update: () => chain };
}

vi.mock("@/lib/db/client", () => ({ getDb: async () => fakeDb() }));
vi.mock("@/app/actions/admin-auth", () => ({
  getAdminSession: async () => ({ role: "admin", permissions: {}, name: "Portaria" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { validateTicket } from "./validations";

beforeEach(() => {
  h.results = [];
});

describe("validateTicket — id do pedido (caminho legado)", () => {
  it("pedido COM ingressos individuais é recusado", async () => {
    // 1) não é id de ingresso; 2) pedido pago; 3) tem ingressos
    h.results = [[], [{ id: ORDER_ID, status: "paid" }], [{ id: "t1" }]];
    const r = await validateTicket(ORDER_ID, GAME_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/QR de cada ingresso/);
  });
});
