import { describe, it, expect } from "vitest";
import { canAccessRoute } from "./nav";

/**
 * Gating de nav por nível. Regra de segurança central:
 * - platformOnly (ex.: Auditoria, Novo Tenant, Assistente IA): SÓ admin do
 *   sistema (isPlatform). Admin de tenant e editor NÃO acessam.
 * - adminOnly (Configurações, Usuários): admin de tenant OU do sistema; editor não.
 * - módulo (ex.: pedidos): admin sempre; editor só com a permissão.
 */
describe("canAccessRoute — platformOnly", () => {
  const routes = ["/admin/auditoria", "/admin/tenants/novo", "/admin/configuracoes/assistente"];

  for (const r of routes) {
    it(`${r}: admin de tenant é bloqueado`, () => {
      expect(canAccessRoute(r, "admin", {}, /* isPlatform */ false)).toBe(false);
    });
    it(`${r}: admin do sistema acessa`, () => {
      expect(canAccessRoute(r, "admin", {}, true)).toBe(true);
    });
    it(`${r}: editor é bloqueado`, () => {
      expect(canAccessRoute(r, "editor", { auditoria: true, tenants: true }, false)).toBe(false);
    });
  }
});

describe("canAccessRoute — adminOnly (Configurações/Usuários)", () => {
  for (const r of ["/admin/configuracoes", "/admin/usuarios"]) {
    it(`${r}: admin de tenant acessa`, () => {
      expect(canAccessRoute(r, "admin", {}, false)).toBe(true);
    });
    it(`${r}: admin do sistema acessa`, () => {
      expect(canAccessRoute(r, "admin", {}, true)).toBe(true);
    });
    it(`${r}: editor é bloqueado`, () => {
      expect(canAccessRoute(r, "editor", {}, false)).toBe(false);
    });
  }
});

describe("canAccessRoute — módulo", () => {
  it("editor com a permissão acessa", () => {
    expect(canAccessRoute("/admin/pedidos", "editor", { pedidos: true }, false)).toBe(true);
  });
  it("editor sem a permissão é bloqueado", () => {
    expect(canAccessRoute("/admin/pedidos", "editor", { jogos: true }, false)).toBe(false);
  });
  it("admin de tenant acessa sem permissão explícita", () => {
    expect(canAccessRoute("/admin/pedidos", "admin", {}, false)).toBe(true);
  });
});

describe("canAccessRoute — rota não mapeada", () => {
  it("admin acessa", () => {
    expect(canAccessRoute("/admin/rota-desconhecida", "admin", {}, false)).toBe(true);
  });
  it("editor é bloqueado (fail-closed)", () => {
    expect(canAccessRoute("/admin/rota-desconhecida", "editor", {}, false)).toBe(false);
  });
});
