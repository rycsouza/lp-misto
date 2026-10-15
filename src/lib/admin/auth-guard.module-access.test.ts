import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Permissão + kill-switch quando a permissão do menu NÃO é a própria feature
 * (ex.: cortesia usa a permissão "jogos" e a feature "cortesia"), e a versão
 * `checkModuleAccess` que devolve o erro em vez de lançar.
 */
const h = vi.hoisted(() => ({
  session: null as unknown,
  ctxSlug: null as string | null,
  reqOrgId: null as string | null,
  disabledByOrg: new Map<string | null, Set<string>>(),
  disabledCalls: [] as Array<string | null>,
}));

vi.mock("@/app/actions/admin-auth", () => ({
  getAdminSession: async () => h.session,
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(h.reqOrgId ? { "x-org-id": h.reqOrgId } : {}),
}));
vi.mock("@/app/actions/platform-tenants", () => ({
  getTenantContextSlug: async () => h.ctxSlug,
}));
vi.mock("@/lib/platform/features", () => ({
  getDisabledFeatures: async (orgId: string | null) => {
    h.disabledCalls.push(orgId);
    return h.disabledByOrg.get(orgId) ?? new Set<string>();
  },
  getOrgIdBySlug: async () => null,
}));

import { checkModuleAccess, requireModule, requireModuleFor } from "./auth-guard";

const ORG_A = "org-a";
const MSG = "Módulo desativado para este clube.";
const JOGOS = { userId: "u-j", email: "j@clube.test", name: "J", role: "editor", permissions: { jogos: true } };
const SO_PEDIDOS = { userId: "u-p", email: "p@clube.test", name: "P", role: "editor", permissions: { pedidos: true } };
const ADMIN_CLUBE = { userId: "u-a", email: "a@clube.test", name: "A", role: "admin", permissions: {} };

beforeEach(() => {
  h.session = null;
  h.ctxSlug = null;
  h.reqOrgId = ORG_A;
  h.disabledByOrg.clear();
  h.disabledCalls.length = 0;
  process.env.PLATFORM_DATABASE_URL = "postgres://plataforma.test/db";
});

afterEach(() => {
  delete process.env.PLATFORM_DATABASE_URL;
});

describe("requireModuleFor: permissão 'jogos' + feature 'cortesia'", () => {
  it("editor com jogos e cortesia desligada → recusa com a mensagem de desativado", async () => {
    h.session = JOGOS;
    h.disabledByOrg.set(ORG_A, new Set(["cortesia"]));
    await expect(requireModuleFor("jogos", "cortesia")).rejects.toThrow(MSG);
  });

  it("editor com jogos e cortesia ligada → passa", async () => {
    h.session = JOGOS;
    await expect(requireModuleFor("jogos", "cortesia")).resolves.toMatchObject({ role: "editor" });
  });

  it("sem a permissão jogos → 'Não autorizado' e a feature NÃO é consultada", async () => {
    h.session = SO_PEDIDOS;
    h.disabledByOrg.set(ORG_A, new Set(["cortesia"]));
    await expect(requireModuleFor("jogos", "cortesia")).rejects.toThrow("Não autorizado");
    expect(h.disabledCalls).toHaveLength(0);
  });

  it("admin do clube também é barrado quando a feature está desligada", async () => {
    h.session = ADMIN_CLUBE;
    h.disabledByOrg.set(ORG_A, new Set(["cortesia"]));
    await expect(requireModuleFor("jogos", "cortesia")).rejects.toThrow(MSG);
  });

  it("desligar a chave de permissão 'jogos' (sem feature mapeada) não bloqueia a cortesia", async () => {
    h.session = JOGOS;
    h.disabledByOrg.set(ORG_A, new Set(["jogos"]));
    await expect(requireModuleFor("jogos", "cortesia")).resolves.toMatchObject({ role: "editor" });
  });
});

describe("checkModuleAccess: devolve o erro sem lançar", () => {
  it("sem sessão → { error: 'Não autorizado' } sem consultar features", async () => {
    const r = await checkModuleAccess("loja");
    expect(r).toEqual({ error: "Não autorizado" });
    expect(h.disabledCalls).toHaveLength(0);
  });

  it("loja desligada para o clube → { error: mensagem de desativado }", async () => {
    h.session = ADMIN_CLUBE;
    h.disabledByOrg.set(ORG_A, new Set(["loja"]));
    await expect(checkModuleAccess("loja")).resolves.toEqual({ error: MSG });
  });

  it("feature ligada → devolve a sessão", async () => {
    h.session = ADMIN_CLUBE;
    await expect(checkModuleAccess("loja")).resolves.toMatchObject({ session: { role: "admin" } });
  });
});

describe("requireModule: rifas e loja passam a usar o próprio kill-switch", () => {
  it("editor com rifas e feature rifas desligada → recusa", async () => {
    h.session = { role: "editor", permissions: { rifas: true } };
    h.disabledByOrg.set(ORG_A, new Set(["rifas"]));
    await expect(requireModule("rifas")).rejects.toThrow(MSG);
  });

  it("editor com loja e feature rifas desligada → passa (features independentes)", async () => {
    h.session = { role: "editor", permissions: { loja: true } };
    h.disabledByOrg.set(ORG_A, new Set(["rifas"]));
    await expect(requireModule("loja")).resolves.toMatchObject({ role: "editor" });
  });
});
