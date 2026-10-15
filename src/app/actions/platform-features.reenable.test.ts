import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Religar uma feature NÃO pode depender da própria feature: as ações de flag
 * (platform-features.ts) usam só a sessão de plataforma. Mesmo com o módulo
 * bloqueado pelo kill-switch (a guarda abaixo lança sempre), o admin do sistema
 * consegue ligar a feature de volta.
 */
const h = vi.hoisted(() => ({
  session: null as unknown,
  writes: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/app/actions/platform-auth", () => ({
  getPlatformSession: async () => h.session,
}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
  revalidateTag: () => {},
  revalidatePath: () => {},
}));
vi.mock("@/lib/db/platform/client", () => ({
  getPlatformDb: () => ({
    insert: () => ({
      values: (v: Record<string, unknown>) => ({
        onConflictDoUpdate: async () => {
          h.writes.push(v);
        },
      }),
    }),
    delete: () => ({
      where: async () => {
        h.writes.push({ deleted: true });
      },
    }),
  }),
}));
// Simula o kill-switch ativo: qualquer módulo bloqueado. Se a ação de flag
// dependesse dele, os testes de religar falhariam.
vi.mock("@/lib/admin/auth-guard", () => ({
  requireModule: async () => {
    throw new Error("Módulo desativado para este clube.");
  },
}));

import { setGlobalFeatureFlag, setOrgFeatureOverride } from "./platform-features";

const PLATAFORMA = { adminId: "p-1", email: "p@sport55.test", name: "Plataforma" };
const ORG = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  h.session = PLATAFORMA;
  h.writes.length = 0;
});

describe("religar feature com o módulo bloqueado pelo kill-switch", () => {
  it("liga globalmente a feature 'validacao'", async () => {
    await expect(setGlobalFeatureFlag("validacao", true)).resolves.toEqual({ success: true });
    expect(h.writes).toContainEqual(expect.objectContaining({ key: "validacao", enabled: true }));
  });

  it("liga a feature só para o clube (override 'on')", async () => {
    await expect(setOrgFeatureOverride(ORG, "validacao", "on")).resolves.toEqual({ success: true });
    expect(h.writes).toContainEqual(expect.objectContaining({ orgId: ORG, key: "validacao", enabled: true }));
  });

  it("remove o override do clube (volta a seguir o global)", async () => {
    await expect(setOrgFeatureOverride(ORG, "validacao", "inherit")).resolves.toEqual({ success: true });
    expect(h.writes).toContainEqual({ deleted: true });
  });

  it("sem sessão de plataforma → 'Não autorizado' (nada é gravado)", async () => {
    h.session = null;
    await expect(setGlobalFeatureFlag("validacao", true)).rejects.toThrow("Não autorizado");
    expect(h.writes).toHaveLength(0);
  });

  it("chave de feature fora do registry → recusa", async () => {
    await expect(setGlobalFeatureFlag("nao_existe", true)).rejects.toThrow("Feature inválida");
    expect(h.writes).toHaveLength(0);
  });
});
