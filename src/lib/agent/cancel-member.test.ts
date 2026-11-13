import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Ferramenta cancel_member do agente (auditoria run-2): cancela pelo mesmo caminho do painel,
 * primeiro no gateway (para de cobrar). Antes só mudava o status no banco e a cobrança seguia.
 */
const h = vi.hoisted(() => ({ cancelled: [] as string[], result: { ok: true, benefitsUntil: null } as unknown, statusWrites: 0 }));

vi.mock("@/lib/membership/cancel", () => ({
  cancelMembership: async (id: string) => {
    h.cancelled.push(id);
    return h.result;
  },
}));
vi.mock("@/app/actions/admin-growth", async (orig) => ({
  ...(await orig<typeof import("@/app/actions/admin-growth")>()),
  updateMemberStatus: async () => {
    h.statusWrites++;
  },
}));

import { executors } from "./executor";

const ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";

beforeEach(() => {
  h.cancelled = [];
  h.result = { ok: true, benefitsUntil: null };
  h.statusWrites = 0;
});

describe("agente: cancel_member", () => {
  it("cancela pelo cancelMembership (gateway primeiro), nunca só o status no banco", async () => {
    const r = await executors.cancel_member({ id: ID });
    expect(r.success).toBe(true);
    expect(h.cancelled).toEqual([ID]);
    expect(h.statusWrites).toBe(0);
  });

  it("falha no gateway: informa e não diz que cancelou", async () => {
    h.result = { ok: false, error: "gateway_error" };
    const r = await executors.cancel_member({ id: ID });
    expect(r.success).toBe(false);
  });
});
