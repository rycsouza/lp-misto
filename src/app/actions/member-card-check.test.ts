import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * verifyMemberCard: conferência de sócio pelo QR, no validador da portaria.
 *
 * - Autorização: mesma regra de /admin/validacao (requireModule("validacao")).
 * - Token validado no servidor (schema explícito) antes de qualquer consulta.
 * - Resposta mínima: nada de e-mail, CPF, telefone, id interno ou o token.
 * - getDb lança se chamado: nenhum caminho deste teste pode tocar o banco direto.
 */
const h = vi.hoisted(() => ({
  session: null as unknown,
  getView: vi.fn(),
  sync: vi.fn(),
  audit: vi.fn(),
  rateOk: true,
}));

vi.mock("@/app/actions/admin-auth", () => ({
  getAdminSession: async () => h.session,
}));
vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    throw new Error("DB_NAO_DEVE_SER_CHAMADO_DIRETO");
  },
}));
vi.mock("@/lib/audit", () => ({
  logAudit: (...args: unknown[]) => h.audit(...args),
}));
vi.mock("@/lib/ratelimit", () => ({
  rateLimit: async () => ({ ok: h.rateOk, remaining: 0 }),
}));
vi.mock("@/lib/membership/card", () => ({
  getMemberCardView: (...args: unknown[]) => h.getView(...args),
}));
vi.mock("@/lib/membership/sync", () => ({
  syncMemberById: (...args: unknown[]) => h.sync(...args),
}));

import { verifyMemberCard } from "./member-card-check";

const TOKEN = "11111111-2222-4333-8444-555555555555";
const ADMIN = { userId: "u-admin", email: "admin@clube.test", name: "Admin", role: "admin", permissions: {} };
const EDITOR_PORTARIA = { userId: "u-ed", email: "ed@clube.test", name: "Ed", role: "editor", permissions: { validacao: true } };
const EDITOR_SEM = { userId: "u-ed2", email: "ed2@clube.test", name: "Ed2", role: "editor", permissions: { jogos: true } };

// Leitura "crua" com campos de contato: a action deve descartar tudo que não for da lista.
function view(over: Record<string, unknown> = {}) {
  return {
    memberId: "m-1",
    name: "Ana Torcedora",
    planName: "Carcará",
    status: "active",
    memberSince: new Date("2026-03-01T12:00:00Z"),
    nextBillingDate: new Date("2026-11-10T12:00:00Z"),
    cancelledAt: null,
    ticketDiscountPct: 5,
    productDiscountPct: 10,
    freeTicketsPerHomeGame: 1,
    cardColor: "#1E3A8A",
    benefits: [],
    email: "ana.privada@exemplo.com",
    cpf: "12345678909",
    phone: "11999990000",
    memberCardToken: TOKEN,
    ...over,
  };
}

beforeEach(() => {
  h.session = ADMIN;
  h.rateOk = true;
  h.getView.mockReset();
  h.getView.mockResolvedValue(view());
  h.sync.mockReset();
  h.sync.mockResolvedValue("updated");
  h.audit.mockReset();
  h.audit.mockResolvedValue(undefined);
});

describe("verifyMemberCard: autorização", () => {
  it("sem sessão recusa, sem consultar a carteirinha nem auditar", async () => {
    h.session = null;
    const r = await verifyMemberCard(TOKEN);
    expect(r).toMatchObject({ found: false, reason: "forbidden" });
    expect(h.getView).not.toHaveBeenCalled();
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("editor sem a permissão validacao recusa", async () => {
    h.session = EDITOR_SEM;
    const r = await verifyMemberCard(TOKEN);
    expect(r).toMatchObject({ found: false, reason: "forbidden" });
    expect(h.getView).not.toHaveBeenCalled();
  });

  it("editor com permissão validacao consulta normalmente", async () => {
    h.session = EDITOR_PORTARIA;
    const r = await verifyMemberCard(TOKEN);
    expect(r).toMatchObject({ found: true, name: "Ana Torcedora" });
  });

  it("admin do clube consulta normalmente", async () => {
    const r = await verifyMemberCard(TOKEN);
    expect(r).toMatchObject({ found: true });
  });
});

describe("verifyMemberCard: entrada", () => {
  it.each([
    ["texto livre", "abc"],
    ["URL inteira (a action recebe só o token)", `https://x.com/socios/carteirinha?token=${TOKEN}`],
    ["UUID sem o formato exato", `${TOKEN}0`],
    ["injeção", `${TOKEN}' OR 1=1 --`],
    ["vazio", ""],
    ["número", 123],
    ["objeto (campo extra)", { token: TOKEN, role: "admin" }],
    ["null", null],
  ])("token inválido (%s) recusa sem consultar", async (_label, value) => {
    const r = await verifyMemberCard(value);
    expect(r).toMatchObject({ found: false, reason: "invalid_token" });
    expect(h.getView).not.toHaveBeenCalled();
  });

  it("limite de consultas por minuto → rate_limited, sem consultar", async () => {
    h.rateOk = false;
    const r = await verifyMemberCard(TOKEN);
    expect(r).toMatchObject({ found: false, reason: "rate_limited" });
    expect(h.getView).not.toHaveBeenCalled();
  });
});

describe("verifyMemberCard: situações", () => {
  it("token que não existe → not_found, sem sócio na resposta", async () => {
    h.getView.mockResolvedValue(null);
    const r = await verifyMemberCard(TOKEN);
    expect(r).toEqual({ found: false, reason: "not_found", message: "Carteirinha não encontrada." });
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("ativo → benefícios, sem data de fim, e registra só ids e situação na auditoria", async () => {
    const r = await verifyMemberCard(TOKEN);
    expect(r).toEqual({
      found: true,
      name: "Ana Torcedora",
      planName: "Carcará",
      status: "active",
      hasBenefits: true,
      benefitsUntil: null,
      memberSince: "2026-03-01T12:00:00.000Z",
    });
    expect(h.audit).toHaveBeenCalledWith("member_card_check", "member", "m-1", { status: "active" });
  });

  it("suspenso → sem benefícios", async () => {
    h.getView.mockResolvedValue(view({ status: "suspended" }));
    const r = await verifyMemberCard(TOKEN);
    expect(r).toMatchObject({ found: true, status: "suspended", hasBenefits: false, benefitsUntil: null });
  });

  it("cancelado dentro do período pago → benefícios até a data", async () => {
    h.getView.mockResolvedValue(view({ status: "cancelled", cancelledAt: new Date("2026-10-01T12:00:00Z") }));
    const r = await verifyMemberCard(TOKEN);
    expect(r).toMatchObject({
      found: true,
      status: "cancelled",
      hasBenefits: true,
      benefitsUntil: "2026-11-10T12:00:00.000Z",
    });
  });

  it("cancelado fora do período pago → sem benefícios e sem data", async () => {
    h.getView.mockResolvedValue(
      view({ status: "cancelled", nextBillingDate: new Date("2020-01-10T12:00:00Z") })
    );
    const r = await verifyMemberCard(TOKEN);
    expect(r).toMatchObject({ found: true, status: "cancelled", hasBenefits: false, benefitsUntil: null });
  });

  it("pendente → reconsulta o gateway (com limite) e relê a carteirinha", async () => {
    h.getView
      .mockResolvedValueOnce(view({ status: "pending" }))
      .mockResolvedValueOnce(view({ status: "active" }));
    const r = await verifyMemberCard(TOKEN);
    expect(h.sync).toHaveBeenCalledWith("m-1");
    expect(h.getView).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ found: true, status: "active", hasBenefits: true });
  });
});

describe("verifyMemberCard: minimização da resposta", () => {
  it("devolve só os campos permitidos, sem contato, id interno nem token", async () => {
    const r = await verifyMemberCard(TOKEN);
    expect(Object.keys(r).sort()).toEqual(
      ["benefitsUntil", "found", "hasBenefits", "memberSince", "name", "planName", "status"].sort()
    );
    const dump = JSON.stringify(r);
    expect(dump).not.toContain("ana.privada@exemplo.com");
    expect(dump).not.toContain("12345678909");
    expect(dump).not.toContain("11999990000");
    expect(dump).not.toContain("m-1");
    expect(dump).not.toContain(TOKEN);
  });
});

describe("verifyMemberCard: erros seguros", () => {
  it("falha ao consultar → erro genérico, sem detalhe interno", async () => {
    h.getView.mockRejectedValue(new Error(`SELECT * FROM members WHERE member_card_token = '${TOKEN}'`));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await verifyMemberCard(TOKEN);
    expect(r).toEqual({
      found: false,
      reason: "error",
      message: "Não foi possível consultar a carteirinha. Tente de novo.",
    });
    expect(JSON.stringify(r)).not.toContain("SELECT");
    // O log também não pode carregar o token.
    expect(JSON.stringify(spy.mock.calls)).not.toContain(TOKEN);
    spy.mockRestore();
  });

  it("falha na sincronização de pendente não derruba a conferência", async () => {
    h.getView
      .mockResolvedValueOnce(view({ status: "pending" }))
      .mockResolvedValueOnce(view({ status: "pending" }));
    h.sync.mockRejectedValue(new Error("gateway fora"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await verifyMemberCard(TOKEN);
    expect(r).toMatchObject({ found: true, status: "pending", hasBenefits: false });
    spy.mockRestore();
  });
});
