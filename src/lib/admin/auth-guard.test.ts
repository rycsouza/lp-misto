import { describe, it, expect, beforeEach, vi } from "vitest";

// Controla o retorno de getAdminSession (dependência das guardas).
const h = vi.hoisted(() => ({ session: null as unknown }));
vi.mock("@/app/actions/admin-auth", () => ({
  getAdminSession: async () => h.session,
}));

import { requireAdmin, requireModule } from "./auth-guard";

beforeEach(() => {
  h.session = null;
});

describe("requireAdmin", () => {
  it("bloqueia sessão ausente", async () => {
    h.session = null;
    await expect(requireAdmin()).rejects.toThrow("Não autorizado");
  });

  it("bloqueia editor", async () => {
    h.session = { role: "editor", permissions: {} };
    await expect(requireAdmin()).rejects.toThrow("Não autorizado");
  });

  it("permite admin", async () => {
    h.session = { role: "admin", permissions: {} };
    await expect(requireAdmin()).resolves.toMatchObject({ role: "admin" });
  });
});

describe("requireModule", () => {
  it("bloqueia sessão ausente", async () => {
    h.session = null;
    await expect(requireModule("cupons")).rejects.toThrow("Não autorizado");
  });

  it("bloqueia editor sem o módulo", async () => {
    h.session = { role: "editor", permissions: { jogos: true } };
    await expect(requireModule("cupons")).rejects.toThrow("Não autorizado");
  });

  it("permite editor com o módulo", async () => {
    h.session = { role: "editor", permissions: { cupons: true } };
    await expect(requireModule("cupons")).resolves.toMatchObject({ role: "editor" });
  });

  it("permite admin mesmo sem o módulo explícito", async () => {
    h.session = { role: "admin", permissions: {} };
    await expect(requireModule("cupons")).resolves.toMatchObject({ role: "admin" });
  });
});
