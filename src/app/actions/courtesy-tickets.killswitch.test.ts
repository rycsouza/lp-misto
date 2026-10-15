import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Kill-switch + permissão das cortesias (courtesy-tickets.ts): emissão, lista de
 * opções e impressão de ingresso (QR assinado = credencial). Permissão "jogos"
 * primeiro; depois a feature "cortesia" do clube.
 */
const h = vi.hoisted(() => ({
  session: null as unknown,
  dbCalls: 0,
  disabled: new Set<string>(),
  disabledCalls: 0,
}));

const DB_MSG = "DB_ALCANCADO_APOS_GUARDA";
const MSG = "Módulo desativado para este clube.";
const GAME = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";

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
vi.mock("@/lib/tickets/generate", () => ({
  ensureTicketsForOrder: async () => [],
}));
vi.mock("@/lib/tickets/token", () => ({
  signTicketToken: async () => "token-teste",
}));
vi.mock("@/lib/config", () => ({
  getSiteConfig: async () => ({ clubLogoUrl: "", siteName: "" }),
}));
vi.mock("qrcode", () => ({
  default: { toDataURL: async () => "data:image/png;base64,AA" },
}));

import { createCourtesyTickets, getCourtesyOptions, getTicketsPrintData } from "./courtesy-tickets";

const ADMIN = { userId: "u-adm", email: "adm@clube.test", name: "Adm", role: "admin", permissions: {} };
const EDITOR_JOGOS = { userId: "u-ed", email: "ed@clube.test", name: "Ed", role: "editor", permissions: { jogos: true } };
const EDITOR_SEM_JOGOS = { userId: "u-ed2", email: "ed2@clube.test", name: "Ed2", role: "editor", permissions: { pedidos: true } };

const EMITIR = {
  gameId: GAME,
  typeCode: "inteira",
  typeName: "Inteira",
  quantity: 1,
  recipientName: "Convidado",
  recipientEmail: "convidado@teste.test",
};

beforeEach(() => {
  h.session = null;
  h.dbCalls = 0;
  h.disabled = new Set();
  h.disabledCalls = 0;
  process.env.PLATFORM_DATABASE_URL = "postgres://plataforma.test/db";
});

describe("cortesia: permissão antes da feature", () => {
  it("sem a permissão jogos → { ok: false, 'Não autorizado' } sem consultar a feature", async () => {
    h.session = EDITOR_SEM_JOGOS;
    h.disabled = new Set(["cortesia"]);
    await expect(createCourtesyTickets(EMITIR)).resolves.toEqual({ ok: false, error: "Não autorizado" });
    expect(h.disabledCalls).toBe(0);
    expect(h.dbCalls).toBe(0);
  });

  it("sem sessão → 'Não autorizado' em emissão, opções e impressão, sem tocar o banco", async () => {
    await expect(createCourtesyTickets(EMITIR)).resolves.toEqual({ ok: false, error: "Não autorizado" });
    await expect(getCourtesyOptions()).rejects.toThrow("Não autorizado");
    await expect(getTicketsPrintData(["t1"])).resolves.toBeNull();
    expect(h.disabledCalls).toBe(0);
    expect(h.dbCalls).toBe(0);
  });
});

describe("cortesia desligada para o clube", () => {
  it("admin: emitir cortesia devolve a mensagem de desativado e não cria pedido", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["cortesia"]);
    await expect(createCourtesyTickets(EMITIR)).resolves.toEqual({ ok: false, error: MSG });
    expect(h.dbCalls).toBe(0);
  });

  it("editor com jogos: emitir cortesia também é barrado", async () => {
    h.session = EDITOR_JOGOS;
    h.disabled = new Set(["cortesia"]);
    await expect(createCourtesyTickets(EMITIR)).resolves.toEqual({ ok: false, error: MSG });
    expect(h.dbCalls).toBe(0);
  });

  it("opções da tela (jogos, tipos, patrocinadores) lançam a mensagem de desativado", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["cortesia"]);
    await expect(getCourtesyOptions()).rejects.toThrow(MSG);
    expect(h.dbCalls).toBe(0);
  });

  it("impressão de ingresso não sai (null) e não toca o banco", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["cortesia"]);
    await expect(getTicketsPrintData(["t1"])).resolves.toBeNull();
    expect(h.dbCalls).toBe(0);
  });
});

describe("cortesia ligada", () => {
  it("admin com cortesia ligada passa a guarda (chega no banco; erro vira resposta)", async () => {
    h.session = ADMIN;
    await expect(createCourtesyTickets(EMITIR)).resolves.toEqual({ ok: false, error: DB_MSG });
    expect(h.dbCalls).toBeGreaterThan(0);
  });

  it("quantidade fracionada é rejeitada antes do banco", async () => {
    h.session = ADMIN;
    await expect(createCourtesyTickets({ ...EMITIR, quantity: 1.5 })).resolves.toEqual({
      ok: false,
      error: "Dados inválidos.",
    });
    expect(h.dbCalls).toBe(0);
  });

  it("editor com jogos e cortesia ligada passa a guarda nas opções e na impressão", async () => {
    h.session = EDITOR_JOGOS;
    await expect(getCourtesyOptions()).rejects.toThrow(DB_MSG);
    await expect(getTicketsPrintData(["t1"])).rejects.toThrow(DB_MSG);
    expect(h.dbCalls).toBeGreaterThan(0);
  });

  it("desligar a retirada não bloqueia a cortesia", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["retirada", "loja"]);
    await expect(getCourtesyOptions()).rejects.toThrow(DB_MSG);
  });
});
