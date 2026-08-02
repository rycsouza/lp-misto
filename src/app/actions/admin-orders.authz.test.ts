import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Regressão de autorização das actions DESTRUTIVAS de pedido. Cancelar/reembolsar
 * é só `admin` — editor (mesmo com o módulo "pedidos") deve ser barrado ANTES de
 * tocar o banco. getDb é mockado para LANÇAR se chamado: sessão não-admin nunca
 * chega no DB, e um admin legítimo chega (prova que a guarda deixa passar).
 */
const h = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("@/app/actions/admin-auth", () => ({
  getAdminSession: async () => h.session,
}));
vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    throw new Error("DB_NAO_DEVE_SER_CHAMADO_SEM_AUTORIZACAO");
  },
}));

import { cancelOrder, refundOrder, bulkCancelOrders, updateOrderStatusAdmin } from "./admin";

beforeEach(() => {
  h.session = null;
});

describe("authz do cancelamento/reembolso de pedidos (só admin)", () => {
  for (const [label, session] of [
    ["sessão ausente", null],
    ["editor COM o módulo pedidos", { role: "editor", permissions: { pedidos: true } }],
  ] as const) {
    it(`cancelOrder bloqueia (${label})`, async () => {
      h.session = session;
      await expect(cancelOrder("order-1")).rejects.toThrow("Não autorizado");
    });

    it(`refundOrder bloqueia (${label})`, async () => {
      h.session = session;
      await expect(refundOrder("order-1")).rejects.toThrow("Não autorizado");
    });

    it(`bulkCancelOrders bloqueia (${label})`, async () => {
      h.session = session;
      await expect(bulkCancelOrders(["order-1"])).rejects.toThrow("Não autorizado");
    });

    it(`updateOrderStatusAdmin bloqueia (${label})`, async () => {
      h.session = session;
      await expect(updateOrderStatusAdmin("order-1", "cancelled")).rejects.toThrow("Não autorizado");
    });
  }

  it("admin passa a guarda (chega no getDb)", async () => {
    h.session = { role: "admin", permissions: {} };
    await expect(cancelOrder("order-1")).rejects.toThrow("DB_NAO_DEVE_SER_CHAMADO_SEM_AUTORIZACAO");
  });
});
