import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Kill-switch NO SERVIDOR (requireModule → assertModuleEnabledForClub).
 *
 * Desligar uma feature no painel da plataforma tem de bloquear também as actions
 * do módulo, mesmo para chamadas diretas (server actions são POST públicos).
 */
const h = vi.hoisted(() => ({
  session: null as unknown,
  ctxSlug: null as string | null,
  reqOrgId: null as string | null,
  headersThrow: false,
  disabledByOrg: new Map<string | null, Set<string>>(),
  orgBySlug: new Map<string, string>(),
  disabledCalls: [] as Array<string | null>,
}));

vi.mock("@/app/actions/admin-auth", () => ({
  getAdminSession: async () => h.session,
}));
vi.mock("next/headers", () => ({
  headers: async () => {
    if (h.headersThrow) throw new Error("fora de request");
    return new Headers(h.reqOrgId ? { "x-org-id": h.reqOrgId } : {});
  },
}));
vi.mock("@/app/actions/platform-tenants", () => ({
  getTenantContextSlug: async () => h.ctxSlug,
}));
vi.mock("@/lib/platform/features", () => ({
  getDisabledFeatures: async (orgId: string | null) => {
    h.disabledCalls.push(orgId);
    return h.disabledByOrg.get(orgId) ?? new Set<string>();
  },
  getOrgIdBySlug: async (slug: string) => h.orgBySlug.get(slug) ?? null,
}));

import { requireModule } from "./auth-guard";

const ORG_A = "org-a";
const ORG_X = "org-x";
const EDITOR_VAL = { userId: "u-ed", email: "ed@clube.test", name: "Ed", role: "editor", permissions: { validacao: true } };
const ADMIN_CLUBE = { userId: "u-adm", email: "adm@clube.test", name: "Adm", role: "admin", permissions: {} };
const ADMIN_SISTEMA = { userId: "u-p", email: "p@sport55.test", name: "Plataforma", role: "admin", permissions: {}, isPlatform: true };
const MSG = "Módulo desativado para este clube.";

beforeEach(() => {
  h.session = null;
  h.ctxSlug = null;
  h.reqOrgId = ORG_A;
  h.headersThrow = false;
  h.disabledByOrg.clear();
  h.orgBySlug.clear();
  h.disabledCalls.length = 0;
  process.env.PLATFORM_DATABASE_URL = "postgres://plataforma.test/db";
});

afterEach(() => {
  delete process.env.PLATFORM_DATABASE_URL;
});

describe("requireModule: kill-switch da feature do módulo", () => {
  it("editor com o módulo + feature desligada no clube → recusa", async () => {
    h.session = EDITOR_VAL;
    h.disabledByOrg.set(ORG_A, new Set(["validacao"]));
    await expect(requireModule("validacao")).rejects.toThrow(MSG);
  });

  it("admin do clube também é barrado (desligar vale para todos no clube)", async () => {
    h.session = ADMIN_CLUBE;
    h.disabledByOrg.set(ORG_A, new Set(["validacao"]));
    await expect(requireModule("validacao")).rejects.toThrow(MSG);
  });

  it("feature ligada → passa", async () => {
    h.session = EDITOR_VAL;
    await expect(requireModule("validacao")).resolves.toMatchObject({ role: "editor" });
  });

  it("desligar outra feature não afeta o módulo", async () => {
    h.session = EDITOR_VAL;
    h.disabledByOrg.set(ORG_A, new Set(["socios", "cupons"]));
    await expect(requireModule("validacao")).resolves.toMatchObject({ role: "editor" });
  });

  it("sem permissão → 'Não autorizado' e a feature nem é consultada", async () => {
    h.session = { role: "editor", permissions: { jogos: true } };
    await expect(requireModule("validacao")).rejects.toThrow("Não autorizado");
    expect(h.disabledCalls).toHaveLength(0);
  });

  it("módulo sem feature mapeada segue como antes, mesmo com features desligadas", async () => {
    h.session = { role: "editor", permissions: { jogos: true } };
    h.disabledByOrg.set(ORG_A, new Set(["validacao", "socios", "cupons", "cantina"]));
    await expect(requireModule("jogos")).resolves.toMatchObject({ role: "editor" });
    expect(h.disabledCalls).toHaveLength(0);
  });

  it("submódulo da cantina segue a feature 'cantina'", async () => {
    h.session = { role: "admin", permissions: {} };
    h.disabledByOrg.set(ORG_A, new Set(["cantina"]));
    await expect(requireModule("cantina_preparo")).rejects.toThrow(MSG);
  });
});

describe("requireModule: admin do sistema operando um clube", () => {
  it("usa o clube do CONTEXTO (não o host) para ler o kill-switch", async () => {
    h.session = ADMIN_SISTEMA;
    h.ctxSlug = "clube-x";
    h.orgBySlug.set("clube-x", ORG_X);
    h.reqOrgId = ORG_A; // host de outro clube: não pode decidir o kill-switch
    h.disabledByOrg.set(ORG_X, new Set(["validacao"]));

    await expect(requireModule("validacao")).rejects.toThrow(MSG);
    expect(h.disabledCalls).toEqual([ORG_X]);
  });

  it("clube em contexto com feature ligada → passa", async () => {
    h.session = ADMIN_SISTEMA;
    h.ctxSlug = "clube-x";
    h.orgBySlug.set("clube-x", ORG_X);
    await expect(requireModule("validacao")).resolves.toMatchObject({ isPlatform: true });
  });
});

describe("requireModule: configuração e falhas", () => {
  it("sem PLATFORM_DATABASE_URL não há kill-switch (igual ao painel)", async () => {
    delete process.env.PLATFORM_DATABASE_URL;
    h.session = EDITOR_VAL;
    h.disabledByOrg.set(ORG_A, new Set(["validacao"]));
    await expect(requireModule("validacao")).resolves.toMatchObject({ role: "editor" });
    expect(h.disabledCalls).toHaveLength(0);
  });

  it("erro inesperado ao resolver o clube propaga (fail-closed)", async () => {
    h.session = EDITOR_VAL;
    h.headersThrow = true;
    await expect(requireModule("validacao")).rejects.toThrow("fora de request");
  });
});
