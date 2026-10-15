import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Regressão de autorização do validador de ingressos (módulo "validacao").
 *
 * As actions são endpoints POST públicos. Sem a guarda, qualquer admin/editor logado
 * conseguiria registrar validação de ingresso (escrita) ou ler nomes de clientes
 * chamando a action direto, sem a permissão da rota /admin/validacao.
 *
 * getDb conta as chamadas: numa sessão sem permissão a guarda barra ANTES do banco.
 * Com permissão, a chamada passa a guarda e chega no banco (a mensagem de erro do
 * mock prova isso).
 */
const h = vi.hoisted(() => ({
  session: null as unknown,
  dbCalls: 0,
}));

const DB_MSG = "DB_ALCANCADO_APOS_GUARDA";

vi.mock("@/app/actions/admin-auth", () => ({
  getAdminSession: async () => h.session,
}));
vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    h.dbCalls++;
    throw new Error(DB_MSG);
  },
}));

import {
  validateTicket,
  getGameValidationStats,
  getGameValidationStatsMany,
  getRecentValidations,
  getTicketTypesForGame,
} from "./validations";

const EDITOR_SEM = { userId: "u-ed", email: "ed@clube.test", name: "Ed", role: "editor", permissions: { jogos: true } };
const EDITOR_PORTARIA = { userId: "u-ed2", email: "ed2@clube.test", name: "Ed2", role: "editor", permissions: { validacao: true } };
const ADMIN = { userId: "u-admin", email: "admin@clube.test", name: "Admin", role: "admin", permissions: {} };
const GAME = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";

beforeEach(() => {
  h.session = null;
  h.dbCalls = 0;
});

describe("validateTicket: exige o módulo validacao", () => {
  it("sem sessão → recusa sem tocar no banco", async () => {
    const r = await validateTicket("abc", GAME);
    expect(r).toEqual({ ok: false, reason: "error", message: "Não autorizado." });
    expect(h.dbCalls).toBe(0);
  });

  it("editor sem a permissão validacao → recusa sem registrar nada", async () => {
    h.session = EDITOR_SEM;
    const r = await validateTicket("0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f", GAME);
    expect(r).toMatchObject({ ok: false, reason: "error" });
    expect(h.dbCalls).toBe(0);
  });

  it("editor com validacao passa a guarda (código inválido é recusado sem banco)", async () => {
    h.session = EDITOR_PORTARIA;
    const r = await validateTicket("abc", GAME);
    expect(r).toMatchObject({ ok: false, reason: "invalid_qr" });
    expect(h.dbCalls).toBe(0);
  });

  it("admin do clube passa a guarda", async () => {
    h.session = ADMIN;
    const r = await validateTicket("abc", GAME);
    expect(r).toMatchObject({ ok: false, reason: "invalid_qr" });
  });
});

describe("leituras do validador: exigem o módulo validacao", () => {
  const READS: { name: string; run: () => Promise<unknown> }[] = [
    { name: "getGameValidationStats", run: () => getGameValidationStats(GAME) },
    { name: "getGameValidationStatsMany", run: () => getGameValidationStatsMany([GAME]) },
    { name: "getRecentValidations", run: () => getRecentValidations(GAME, 12) },
    { name: "getTicketTypesForGame", run: () => getTicketTypesForGame(GAME) },
  ];

  for (const { name, run } of READS) {
    it(`${name} bloqueia sessão ausente sem tocar no banco`, async () => {
      h.session = null;
      await expect(run()).rejects.toThrow("Não autorizado");
      expect(h.dbCalls).toBe(0);
    });

    it(`${name} bloqueia editor sem o módulo sem tocar no banco`, async () => {
      h.session = EDITOR_SEM;
      await expect(run()).rejects.toThrow("Não autorizado");
      expect(h.dbCalls).toBe(0);
    });

    it(`${name} libera quem tem o módulo validacao`, async () => {
      h.session = EDITOR_PORTARIA;
      await expect(run()).rejects.toThrow(DB_MSG);
      expect(h.dbCalls).toBe(1);
    });
  }
});
