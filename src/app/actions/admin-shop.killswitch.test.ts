import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Kill-switch + permissão das actions ADMIN da loja (admin-shop.ts).
 * Ordem: permissão "loja" primeiro (sem ela, a feature nem é consultada); depois
 * a feature "loja" do clube. Checkout e vitrine públicos NÃO passam por este arquivo.
 * getDb conta as chamadas e lança ao ser usado: se a guarda deixar passar, dbCalls > 0.
 */
const h = vi.hoisted(() => ({
  session: null as unknown,
  dbCalls: 0,
  disabled: new Set<string>(),
  disabledCalls: 0,
}));

const DB_MSG = "DB_ALCANCADO_APOS_GUARDA";
const MSG = "Módulo desativado para este clube.";
const PID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";

vi.mock("@/app/actions/admin-auth", () => ({
  getAdminSession: async () => h.session,
}));
vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    h.dbCalls++;
    throw new Error(DB_MSG);
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-org-id": "org-a" }),
}));
vi.mock("@/app/actions/platform-tenants", () => ({
  getTenantContextSlug: async () => null,
}));
vi.mock("@/lib/platform/features", () => ({
  getDisabledFeatures: async () => {
    h.disabledCalls++;
    return new Set(h.disabled);
  },
  getOrgIdBySlug: async () => null,
}));

import {
  getAdminProducts,
  getAdminProductById,
  getProductStockTotals,
  createProduct,
  deleteProduct,
  toggleProductActive,
  bulkUpdateProductsActive,
} from "./admin-shop";

const ADMIN = { userId: "u-adm", email: "adm@clube.test", name: "Adm", role: "admin", permissions: {} };
const EDITOR_LOJA = { userId: "u-ed", email: "ed@clube.test", name: "Ed", role: "editor", permissions: { loja: true } };
const EDITOR_SEM_LOJA = { userId: "u-ed2", email: "ed2@clube.test", name: "Ed2", role: "editor", permissions: { jogos: true } };
const PRODUCT = { name: "Camisa", slug: "camisa", category: "vestuario", priceCents: 1000 } as unknown as Parameters<typeof createProduct>[0];

beforeEach(() => {
  h.session = null;
  h.dbCalls = 0;
  h.disabled = new Set();
  h.disabledCalls = 0;
  process.env.PLATFORM_DATABASE_URL = "postgres://plataforma.test/db";
});

describe("loja: permissão antes da feature", () => {
  it("leitura sem sessão → 'Não autorizado', sem consultar features nem tocar o banco", async () => {
    await expect(getAdminProducts({ page: 1 })).rejects.toThrow("Não autorizado");
    expect(h.disabledCalls).toBe(0);
    expect(h.dbCalls).toBe(0);
  });

  it("getProductStockTotals sem sessão é barrado mesmo com lista vazia (antes não tinha guarda)", async () => {
    await expect(getProductStockTotals([PID])).rejects.toThrow("Não autorizado");
    expect(h.dbCalls).toBe(0);
  });

  it("getAdminProductById sem sessão → 'Não autorizado' e não toca o banco", async () => {
    await expect(getAdminProductById(PID)).rejects.toThrow("Não autorizado");
    expect(h.dbCalls).toBe(0);
  });

  it("editor sem a permissão loja → { success: false, 'Não autorizado' } sem consultar a feature", async () => {
    h.session = EDITOR_SEM_LOJA;
    h.disabled = new Set(["loja"]);
    await expect(createProduct(PRODUCT)).resolves.toEqual({ success: false, error: "Não autorizado" });
    expect(h.disabledCalls).toBe(0);
    expect(h.dbCalls).toBe(0);
  });
});

describe("loja desligada para o clube", () => {
  it("admin do clube: createProduct devolve a mensagem de desativado e não toca o banco", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["loja"]);
    await expect(createProduct(PRODUCT)).resolves.toEqual({ success: false, error: MSG });
    expect(h.dbCalls).toBe(0);
  });

  it("editor com loja: deleteProduct devolve { success: false, error } e não toca o banco", async () => {
    h.session = EDITOR_LOJA;
    h.disabled = new Set(["loja"]);
    await expect(deleteProduct(PID)).resolves.toEqual({ success: false, error: MSG });
    expect(h.dbCalls).toBe(0);
  });

  it("editor com loja: toggleProductActive (void) lança a mensagem de desativado", async () => {
    h.session = EDITOR_LOJA;
    h.disabled = new Set(["loja"]);
    await expect(toggleProductActive(PID, true)).rejects.toThrow(MSG);
    expect(h.dbCalls).toBe(0);
  });

  it("bulkUpdateProductsActive lança a mensagem de desativado sem tocar o banco", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["loja"]);
    await expect(bulkUpdateProductsActive([PID], true)).rejects.toThrow(MSG);
    expect(h.dbCalls).toBe(0);
  });

  it("leituras admin (lista e detalhe) são bloqueadas com a mensagem de desativado", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["loja"]);
    await expect(getAdminProducts({ page: 1 })).rejects.toThrow(MSG);
    await expect(getAdminProductById(PID)).rejects.toThrow(MSG);
    expect(h.dbCalls).toBe(0);
  });
});

describe("loja ligada, ou outra feature desligada", () => {
  it("admin com loja ligada passa a guarda (chega no banco)", async () => {
    h.session = ADMIN;
    await expect(getAdminProducts({ page: 1 })).rejects.toThrow(DB_MSG);
    expect(h.dbCalls).toBeGreaterThan(0);
  });

  it("editor com loja e feature ligada passa a guarda", async () => {
    h.session = EDITOR_LOJA;
    await expect(createProduct(PRODUCT)).rejects.toThrow(DB_MSG);
    expect(h.dbCalls).toBeGreaterThan(0);
  });

  it("desligar outra feature (rifas) não bloqueia a loja", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["rifas", "cortesia"]);
    await expect(getAdminProducts({ page: 1 })).rejects.toThrow(DB_MSG);
  });
});
