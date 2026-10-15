import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Kill-switch + permissão das actions ADMIN de sorteios (admin-raffles.ts).
 * Ordem: permissão "rifas" primeiro; depois a feature "rifas" do clube. A compra
 * pública de número de sorteio NÃO passa por este arquivo.
 */
const h = vi.hoisted(() => ({
  session: null as unknown,
  dbCalls: 0,
  disabled: new Set<string>(),
  disabledCalls: 0,
}));

const DB_MSG = "DB_ALCANCADO_APOS_GUARDA";
const MSG = "Módulo desativado para este clube.";

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
  getAdminRaffles,
  getAdminRaffleStatusCounts,
  createRaffle,
  deleteRaffle,
  drawRaffleWinner,
  toggleRaffleActive,
  exportRaffleBuyersCSV,
  getRaffleReport,
} from "./admin-raffles";

const ADMIN = { userId: "u-adm", email: "adm@clube.test", name: "Adm", role: "admin", permissions: {} };
const EDITOR_RIFAS = { userId: "u-ed", email: "ed@clube.test", name: "Ed", role: "editor", permissions: { rifas: true } };
const EDITOR_SEM_RIFAS = { userId: "u-ed2", email: "ed2@clube.test", name: "Ed2", role: "editor", permissions: { jogos: true } };
const VALID_CREATE = { name: "R", slug: "r", numberPriceCents: 1000, totalNumbers: 10 };

beforeEach(() => {
  h.session = null;
  h.dbCalls = 0;
  h.disabled = new Set();
  h.disabledCalls = 0;
  process.env.PLATFORM_DATABASE_URL = "postgres://plataforma.test/db";
});

describe("sorteios: permissão antes da feature", () => {
  it("editor sem a permissão rifas → 'Não autorizado' e a feature NÃO é consultada", async () => {
    h.session = EDITOR_SEM_RIFAS;
    h.disabled = new Set(["rifas"]);
    await expect(getAdminRaffles({ page: 1 })).rejects.toThrow("Não autorizado");
    await expect(createRaffle(VALID_CREATE)).resolves.toEqual({ success: false, error: "Não autorizado" });
    expect(h.disabledCalls).toBe(0);
    expect(h.dbCalls).toBe(0);
  });
});

describe("sorteios desligados para o clube", () => {
  it("admin: createRaffle e deleteRaffle devolvem a mensagem de desativado", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["rifas"]);
    await expect(createRaffle(VALID_CREATE)).resolves.toEqual({ success: false, error: MSG });
    await expect(deleteRaffle("r1")).resolves.toEqual({ success: false, error: MSG });
    expect(h.dbCalls).toBe(0);
  });

  it("admin: drawRaffleWinner (sorteio) é barrado antes do banco", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["rifas"]);
    await expect(drawRaffleWinner("prize-1", 5)).resolves.toEqual({ success: false, error: MSG });
    expect(h.dbCalls).toBe(0);
  });

  it("admin: leituras (lista, status, relatório, CSV) lançam a mensagem de desativado", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["rifas"]);
    await expect(getAdminRaffles({ page: 1 })).rejects.toThrow(MSG);
    await expect(getAdminRaffleStatusCounts()).rejects.toThrow(MSG);
    await expect(getRaffleReport()).rejects.toThrow(MSG);
    await expect(exportRaffleBuyersCSV("r1")).rejects.toThrow(MSG);
    expect(h.dbCalls).toBe(0);
  });

  it("editor com rifas: toggleRaffleActive (void) lança a mensagem e não toca o banco", async () => {
    h.session = EDITOR_RIFAS;
    h.disabled = new Set(["rifas"]);
    await expect(toggleRaffleActive("r1", true)).rejects.toThrow(MSG);
    expect(h.dbCalls).toBe(0);
  });
});

describe("sorteios ligados, ou outra feature desligada", () => {
  it("editor com rifas e feature ligada passa a guarda", async () => {
    h.session = EDITOR_RIFAS;
    await expect(getAdminRaffles({ page: 1 })).rejects.toThrow(DB_MSG);
    expect(h.dbCalls).toBeGreaterThan(0);
  });

  it("desligar a loja não bloqueia os sorteios", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["loja"]);
    await expect(getAdminRaffles({ page: 1 })).rejects.toThrow(DB_MSG);
  });
});
