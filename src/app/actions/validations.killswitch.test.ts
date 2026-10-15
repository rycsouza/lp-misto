import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Integração leve: kill-switch do módulo "validacao" nas actions do validador.
 *
 * Com a feature "validacao" desligada para o clube, nenhuma action do validador
 * pode tocar o banco. getDb conta as chamadas e lança ao ser usado: se a guarda
 * deixar passar, o teste acusa (dbCalls > 0).
 */
const h = vi.hoisted(() => ({
  session: null as unknown,
  dbCalls: 0,
  disabled: new Set<string>(),
}));

const DB_MSG = "DB_ALCANCADO_APOS_GUARDA";
const GAME = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const TICKET = "2b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";

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
  getDisabledFeatures: async () => new Set(h.disabled),
  getOrgIdBySlug: async () => null,
}));

import { validateTicket, getRecentValidations, getGameValidationStats } from "./validations";
import { MODULE_DISABLED_MESSAGE } from "@/lib/platform/module-gate";

const ADMIN = { userId: "u-adm", email: "adm@clube.test", name: "Adm", role: "admin", permissions: {} };
const PORTARIA = { userId: "u-ed", email: "ed@clube.test", name: "Ed", role: "editor", permissions: { validacao: true } };
const SEM_PERM = { userId: "u-ed2", email: "ed2@clube.test", name: "Ed2", role: "editor", permissions: { jogos: true } };

beforeEach(() => {
  h.session = null;
  h.dbCalls = 0;
  h.disabled = new Set();
  process.env.PLATFORM_DATABASE_URL = "postgres://plataforma.test/db";
});

afterEach(() => {
  delete process.env.PLATFORM_DATABASE_URL;
});

describe("validador com a feature 'validacao' desligada", () => {
  it("validateTicket é bloqueado com mensagem de módulo desativado e não toca o banco", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["validacao"]);
    const r = await validateTicket(TICKET, GAME);
    expect(r).toEqual({ ok: false, reason: "error", message: MODULE_DISABLED_MESSAGE });
    expect(h.dbCalls).toBe(0);
  });

  it("portaria (editor com validacao) também é bloqueada", async () => {
    h.session = PORTARIA;
    h.disabled = new Set(["validacao"]);
    const r = await validateTicket(TICKET, GAME);
    expect(r).toMatchObject({ ok: false, message: MODULE_DISABLED_MESSAGE });
    expect(h.dbCalls).toBe(0);
  });

  it("sem permissão a mensagem continua genérica (não revela o estado do kill-switch)", async () => {
    h.session = SEM_PERM;
    h.disabled = new Set(["validacao"]);
    const r = await validateTicket(TICKET, GAME);
    expect(r).toEqual({ ok: false, reason: "error", message: "Não autorizado." });
    expect(h.dbCalls).toBe(0);
  });

  it("getRecentValidations lança a mensagem de desligado e não toca o banco", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["validacao"]);
    await expect(getRecentValidations(GAME)).rejects.toThrow(MODULE_DISABLED_MESSAGE);
    expect(h.dbCalls).toBe(0);
  });

  it("getGameValidationStats lança a mensagem de desligado e não toca o banco", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["validacao"]);
    await expect(getGameValidationStats(GAME)).rejects.toThrow(MODULE_DISABLED_MESSAGE);
    expect(h.dbCalls).toBe(0);
  });
});

describe("validador com a feature 'validacao' ligada", () => {
  it("a guarda deixa passar e a chamada chega ao banco", async () => {
    h.session = ADMIN;
    const result = await validateTicket(TICKET, GAME).catch((e: Error) => e);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe(DB_MSG);
    expect(h.dbCalls).toBeGreaterThan(0);
  });

  it("desligar outro módulo (socios) não bloqueia o validador", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["socios", "cupons"]);
    const result = await validateTicket(TICKET, GAME).catch((e: Error) => e);
    expect((result as Error).message).toBe(DB_MSG);
  });
});
