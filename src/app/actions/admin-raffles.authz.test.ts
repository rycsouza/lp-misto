import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Regressão de autorização das actions de rifa. requireRifas() (admin OU
 * permissão "rifas") deve barrar ANTES de tocar o banco. getDb é mockado para
 * LANÇAR se chamado — assim, sessão sem permissão nunca chega no DB, e um admin
 * legítimo chega (prova que a guarda deixa passar).
 */
const h = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("@/app/actions/admin-auth", () => ({
  getAdminSession: async () => h.session,
}));
vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    throw new Error("DB_NAO_DEVE_SER_CHAMADO_SEM_AUTORIZACAO");
  },
}));

import { getAdminRaffles, createRaffle, drawRaffleWinner } from "./admin-raffles";

const VALID_CREATE = { name: "R", slug: "r", numberPriceCents: 1000, totalNumbers: 10 };

beforeEach(() => {
  h.session = null;
});

describe("authz das actions de rifa", () => {
  for (const [label, session] of [
    ["sessão ausente", null],
    ["editor sem o módulo rifas", { role: "editor", permissions: { jogos: true } }],
  ] as const) {
    it(`getAdminRaffles bloqueia (${label})`, async () => {
      h.session = session;
      await expect(getAdminRaffles({ page: 1 })).rejects.toThrow("Não autorizado");
    });

    it(`createRaffle bloqueia (${label})`, async () => {
      h.session = session;
      await expect(createRaffle(VALID_CREATE)).resolves.toMatchObject({ success: false });
    });

    it(`drawRaffleWinner bloqueia (${label})`, async () => {
      h.session = session;
      await expect(drawRaffleWinner("prize-1", 5)).resolves.toMatchObject({ success: false });
    });
  }

  it("admin passa a guarda (chega no getDb)", async () => {
    h.session = { role: "admin", permissions: {} };
    // Autorizado → tenta o banco → cai no mock que lança o sentinel.
    await expect(getAdminRaffles({ page: 1 })).rejects.toThrow("DB_NAO_DEVE_SER_CHAMADO_SEM_AUTORIZACAO");
  });

  it("editor COM o módulo rifas passa a guarda", async () => {
    h.session = { role: "editor", permissions: { rifas: true } };
    await expect(getAdminRaffles({ page: 1 })).rejects.toThrow("DB_NAO_DEVE_SER_CHAMADO_SEM_AUTORIZACAO");
  });
});
