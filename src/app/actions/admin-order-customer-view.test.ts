import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Visão do cliente no detalhe do pedido (admin): mesma guarda do módulo "pedidos", id validado
 * antes do banco, e o pedido sai SEM credenciais (o loader é chamado com o id validado).
 */
const h = vi.hoisted(() => ({ session: null as unknown, loaded: [] as string[] }));

vi.mock("@/app/actions/admin-auth", () => ({
  getAdminSession: async () => h.session,
}));
vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    throw new Error("DB_NAO_DEVE_SER_CHAMADO");
  },
}));
vi.mock("@/lib/orders/enrich", () => ({
  loadOrderCustomerPreview: async (id: string) => {
    h.loaded.push(id);
    return { id, status: "paid", credentialsHidden: true };
  },
}));

import { getAdminOrderCustomerView } from "./admin";

const ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";

beforeEach(() => {
  h.session = null;
  h.loaded = [];
});

describe("getAdminOrderCustomerView", () => {
  it("bloqueia sessão ausente e editor sem o módulo pedidos, sem carregar o pedido", async () => {
    await expect(getAdminOrderCustomerView(ID)).rejects.toThrow("Não autorizado");
    h.session = { role: "editor", permissions: { jogos: true } };
    await expect(getAdminOrderCustomerView(ID)).rejects.toThrow("Não autorizado");
    expect(h.loaded).toEqual([]);
  });

  it("id inválido: devolve null sem carregar nada", async () => {
    h.session = { role: "admin", permissions: {} };
    for (const bad of ["", "abc", "1 OR 1=1", `${ID}x`]) {
      expect(await getAdminOrderCustomerView(bad)).toBeNull();
    }
    expect(h.loaded).toEqual([]);
  });

  it("admin e editor com o módulo pedidos: carrega a prévia (sem credenciais)", async () => {
    h.session = { role: "admin", permissions: {} };
    expect(await getAdminOrderCustomerView(ID)).toMatchObject({ id: ID, credentialsHidden: true });
    h.session = { role: "editor", permissions: { pedidos: true } };
    expect(await getAdminOrderCustomerView(ID)).toMatchObject({ id: ID });
    expect(h.loaded).toEqual([ID, ID]);
  });
});
