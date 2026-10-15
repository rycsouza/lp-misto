import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Retirada de pedidos (pickup.ts): fila, busca por código, confirmação de entrega e
 * marcação "pronto". Antes desta guarda, QUALQUER sessão de admin (inclusive editor
 * sem permissão) lia a fila com dados de cliente e confirmava entregas. Agora exige
 * a permissão "pedidos" (mesma do menu) e depois a feature "retirada" do clube.
 */
const h = vi.hoisted(() => ({
  session: null as unknown,
  dbCalls: 0,
  disabled: new Set<string>(),
  disabledCalls: 0,
}));

const DB_MSG = "DB_ALCANCADO_APOS_GUARDA";
const MSG = "Módulo desativado para este clube.";
const ORDER = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";

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
vi.mock("@/lib/audit", () => ({
  logAudit: async () => {},
}));
vi.mock("@/lib/pickup/code", () => ({
  ensurePickupCode: async () => "123456",
  normalizePickupCode: (raw: string) => raw.replace(/\D/g, ""),
}));

import {
  getPendingPickups,
  getRecentPickups,
  lookupPickupByCode,
  confirmPickupDelivery,
  markPickupReady,
} from "./pickup";

const ADMIN = { userId: "u-adm", email: "adm@clube.test", name: "Adm", role: "admin", permissions: {} };
const EDITOR_PEDIDOS = { userId: "u-ed", email: "ed@clube.test", name: "Ed", role: "editor", permissions: { pedidos: true } };
const EDITOR_SEM_PEDIDOS = { userId: "u-ed2", email: "ed2@clube.test", name: "Ed2", role: "editor", permissions: { validacao: true } };

beforeEach(() => {
  h.session = null;
  h.dbCalls = 0;
  h.disabled = new Set();
  h.disabledCalls = 0;
  process.env.PLATFORM_DATABASE_URL = "postgres://plataforma.test/db";
});

describe("retirada: permissão 'pedidos' antes da feature", () => {
  it("editor sem pedidos não lê a fila, não busca código e não confirma entrega", async () => {
    h.session = EDITOR_SEM_PEDIDOS;
    await expect(getPendingPickups()).rejects.toThrow("Não autorizado");
    await expect(getRecentPickups()).rejects.toThrow("Não autorizado");
    await expect(markPickupReady([ORDER])).rejects.toThrow("Não autorizado");
    await expect(lookupPickupByCode("123456")).resolves.toEqual({
      ok: false,
      reason: "error",
      message: "Não autorizado",
    });
    await expect(confirmPickupDelivery(ORDER)).resolves.toEqual({ success: false, error: "Não autorizado" });
    expect(h.disabledCalls).toBe(0);
    expect(h.dbCalls).toBe(0);
  });

  it("sem sessão → 'Não autorizado' sem tocar o banco", async () => {
    await expect(getPendingPickups()).rejects.toThrow("Não autorizado");
    await expect(confirmPickupDelivery(ORDER)).resolves.toMatchObject({ success: false, error: "Não autorizado" });
    expect(h.dbCalls).toBe(0);
  });
});

describe("retirada desligada para o clube", () => {
  it("editor com pedidos: fila e busca devolvem/lançam a mensagem de desativado", async () => {
    h.session = EDITOR_PEDIDOS;
    h.disabled = new Set(["retirada"]);
    await expect(getPendingPickups()).rejects.toThrow(MSG);
    await expect(getRecentPickups()).rejects.toThrow(MSG);
    await expect(lookupPickupByCode("123456")).resolves.toEqual({ ok: false, reason: "error", message: MSG });
    expect(h.dbCalls).toBe(0);
  });

  it("admin: confirmar entrega devolve a mensagem de desativado e não altera o pedido", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["retirada"]);
    await expect(confirmPickupDelivery(ORDER)).resolves.toEqual({ success: false, error: MSG });
    await expect(markPickupReady([ORDER])).rejects.toThrow(MSG);
    expect(h.dbCalls).toBe(0);
  });
});

describe("retirada ligada, ou outra feature desligada", () => {
  it("admin com retirada ligada passa a guarda (chega no banco)", async () => {
    h.session = ADMIN;
    await expect(lookupPickupByCode("123456")).resolves.toEqual({
      ok: false,
      reason: "error",
      message: "Erro ao buscar o pedido.",
    });
    expect(h.dbCalls).toBeGreaterThan(0);
  });

  it("editor com pedidos e retirada ligada passa a guarda na confirmação", async () => {
    h.session = EDITOR_PEDIDOS;
    await expect(confirmPickupDelivery(ORDER)).resolves.toEqual({
      success: false,
      error: "Erro ao confirmar a retirada.",
    });
    expect(h.dbCalls).toBeGreaterThan(0);
  });

  it("desligar a cortesia não bloqueia a retirada", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["cortesia"]);
    await expect(getPendingPickups()).rejects.toThrow(DB_MSG);
  });
});
