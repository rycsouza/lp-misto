import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * verifyMemberCard: conferência de sócio no validador da portaria, por QR (token) ou
 * por código curto digitado (S-XXXXXXXX).
 *
 * - Autorização: mesma regra de /admin/validacao (requireModule("validacao")).
 * - Entrada validada no servidor (schema estrito, um de dois formatos) antes de qualquer consulta.
 * - Busca por código: mesmo rate limit + limite extra por admin; 0/1/2 resultados.
 * - Resposta mínima: nada de e-mail, CPF, telefone, id interno ou o token.
 * - getDb lança se chamado: nenhum caminho deste teste pode tocar o banco direto.
 */
const h = vi.hoisted(() => ({
  session: null as unknown,
  getView: vi.fn(),
  getViewByCode: vi.fn(),
  sync: vi.fn(),
  audit: vi.fn(),
  rateOk: true,
  codeRateOk: true,
  rateKeys: [] as string[],
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
  rateLimit: async (key: string) => {
    h.rateKeys.push(key);
    let ok = true;
    if (key.startsWith("rl:member-card-code:")) ok = h.codeRateOk;
    else if (key.startsWith("rl:member-card-check:")) ok = h.rateOk;
    return { ok, remaining: 0 };
  },
}));
vi.mock("@/lib/membership/card", () => ({
  getMemberCardView: (...args: unknown[]) => h.getView(...args),
  getMemberCardViewByCodePrefix: (...args: unknown[]) => h.getViewByCode(...args),
}));
vi.mock("@/lib/membership/sync", () => ({
  syncMemberById: (...args: unknown[]) => h.sync(...args),
}));

import { verifyMemberCard } from "./member-card-check";

const TOKEN = "11111111-2222-4333-8444-555555555555";
// Primeiros 8 hex do TOKEN: "11111111" → código "S-11111111".
const CODE = "S-11111111";
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

const found = (over: Record<string, unknown> = {}) => ({ kind: "found", view: view(over) });

beforeEach(() => {
  h.session = ADMIN;
  h.rateOk = true;
  h.codeRateOk = true;
  h.rateKeys = [];
  h.getView.mockReset();
  h.getView.mockResolvedValue(view());
  h.getViewByCode.mockReset();
  h.getViewByCode.mockResolvedValue(found());
  h.sync.mockReset();
  h.sync.mockResolvedValue("updated");
  h.audit.mockReset();
  h.audit.mockResolvedValue(undefined);
});

function noLookup() {
  expect(h.getView).not.toHaveBeenCalled();
  expect(h.getViewByCode).not.toHaveBeenCalled();
  expect(h.audit).not.toHaveBeenCalled();
}

describe("verifyMemberCard: autorização", () => {
  it("sem sessão recusa, sem consultar a carteirinha nem auditar (token e código)", async () => {
    h.session = null;
    expect(await verifyMemberCard({ token: TOKEN })).toMatchObject({ found: false, reason: "forbidden" });
    expect(await verifyMemberCard({ code: CODE })).toMatchObject({ found: false, reason: "forbidden" });
    noLookup();
  });

  it("editor sem a permissão validacao recusa (token e código)", async () => {
    h.session = EDITOR_SEM;
    expect(await verifyMemberCard({ token: TOKEN })).toMatchObject({ found: false, reason: "forbidden" });
    expect(await verifyMemberCard({ code: CODE })).toMatchObject({ found: false, reason: "forbidden" });
    noLookup();
  });

  it("editor com permissão validacao consulta por código normalmente", async () => {
    h.session = EDITOR_PORTARIA;
    const r = await verifyMemberCard({ code: CODE });
    expect(r).toMatchObject({ found: true, name: "Ana Torcedora" });
  });

  it("admin do clube consulta por token normalmente", async () => {
    const r = await verifyMemberCard({ token: TOKEN });
    expect(r).toMatchObject({ found: true });
  });
});

describe("verifyMemberCard: entrada", () => {
  it.each([
    ["texto livre", { token: "abc" }],
    ["UUID sem o formato exato", { token: `${TOKEN}0` }],
    ["injeção no token", { token: `${TOKEN}' OR 1=1 --` }],
    ["token vazio", { token: "" }],
    ["token como string solta (formato antigo, não aceito)", TOKEN],
    ["URL inteira", `https://x.com/socios/carteirinha?token=${TOKEN}`],
    ["campo extra junto com o token", { token: TOKEN, role: "admin" }],
    ["token e código juntos", { token: TOKEN, code: CODE }],
    ["vazio", {}],
    ["número", 123],
    ["null", null],
  ])("entrada inválida (%s) recusa sem consultar", async (_label, value) => {
    const r = await verifyMemberCard(value);
    expect(r).toMatchObject({ found: false, reason: "invalid_token" });
    noLookup();
  });

  it.each([
    ["sete caracteres", { code: "S-1111111" }],
    ["nove caracteres", { code: "S-111111111" }],
    ["letra fora de hex", { code: "S-1111111G" }],
    ["sem o S", { code: "11111111" }],
    ["wildcard de LIKE", { code: "S-11111111%" }],
    ["underscore de LIKE", { code: "S-1111111_" }],
    ["injeção no código", { code: "S-11111111' OR 1=1 --" }],
    ["vazio", { code: "" }],
    ["só o prefixo", { code: "S-" }],
  ])("código inválido (%s) recusa sem consultar", async (_label, value) => {
    const r = await verifyMemberCard(value);
    expect(r).toMatchObject({ found: false, reason: "invalid_code" });
    noLookup();
  });

  it("código muito longo ou não-texto → entrada inválida, sem consultar", async () => {
    expect(await verifyMemberCard({ code: "S-".padEnd(80, "1") })).toMatchObject({ reason: "invalid_token" });
    expect(await verifyMemberCard({ code: 11111111 })).toMatchObject({ reason: "invalid_token" });
    noLookup();
  });

  it("código normalizado no servidor: aceita forma com minúsculas e espaços", async () => {
    await verifyMemberCard({ code: "s-1111 1111" });
    expect(h.getViewByCode).toHaveBeenCalledWith("11111111");
  });
});

describe("verifyMemberCard: rate limit", () => {
  it("limite geral de consultas por token → rate_limited, sem consultar", async () => {
    h.rateOk = false;
    const r = await verifyMemberCard({ token: TOKEN });
    expect(r).toMatchObject({ found: false, reason: "rate_limited" });
    noLookup();
  });

  it("consulta por código também passa pelo limite geral", async () => {
    h.rateOk = false;
    const r = await verifyMemberCard({ code: CODE });
    expect(r).toMatchObject({ found: false, reason: "rate_limited" });
    noLookup();
  });

  it("limite extra de buscas por código esgotado → rate_limited, sem consultar", async () => {
    h.codeRateOk = false;
    const r = await verifyMemberCard({ code: CODE });
    expect(r).toMatchObject({ found: false, reason: "rate_limited" });
    noLookup();
  });

  it("limite extra de código não afeta a consulta por token", async () => {
    h.codeRateOk = false;
    const r = await verifyMemberCard({ token: TOKEN });
    expect(r).toMatchObject({ found: true });
  });

  it("busca por código usa os dois limites, por admin", async () => {
    await verifyMemberCard({ code: CODE });
    expect(h.rateKeys).toEqual(["rl:member-card-check:u-admin", "rl:member-card-code:u-admin"]);
  });

  it("consulta por token usa só o limite geral", async () => {
    await verifyMemberCard({ token: TOKEN });
    expect(h.rateKeys).toEqual(["rl:member-card-check:u-admin"]);
  });
});

describe("verifyMemberCard: busca por código (0, 1 ou 2 resultados)", () => {
  it("nenhum sócio com o prefixo → not_found, sem auditoria", async () => {
    h.getViewByCode.mockResolvedValue({ kind: "none" });
    const r = await verifyMemberCard({ code: CODE });
    expect(r).toEqual({ found: false, reason: "not_found", message: "Carteirinha não encontrada." });
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("dois sócios com o mesmo prefixo → ambíguo, sem dados e sem auditoria", async () => {
    h.getViewByCode.mockResolvedValue({ kind: "ambiguous" });
    const r = await verifyMemberCard({ code: CODE });
    expect(r).toEqual({
      found: false,
      reason: "ambiguous",
      message: "Código ambíguo — leia o QR da carteirinha.",
    });
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("um sócio → mesmo retorno da busca por token, e auditoria com ids e situação", async () => {
    const r = await verifyMemberCard({ code: CODE });
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

  it("sócio pendente encontrado por código → reconsulta o gateway e relê pelo mesmo código", async () => {
    h.getViewByCode
      .mockResolvedValueOnce(found({ status: "pending" }))
      .mockResolvedValueOnce(found({ status: "active" }));
    const r = await verifyMemberCard({ code: CODE });
    expect(h.sync).toHaveBeenCalledWith("m-1");
    expect(h.getViewByCode).toHaveBeenCalledTimes(2);
    expect(h.getViewByCode).toHaveBeenNthCalledWith(2, "11111111");
    expect(r).toMatchObject({ found: true, status: "active", hasBenefits: true });
  });

  it("após a sincronização, se o código ficar ambíguo, não devolve dados", async () => {
    h.getViewByCode
      .mockResolvedValueOnce(found({ status: "pending" }))
      .mockResolvedValueOnce({ kind: "ambiguous" });
    const r = await verifyMemberCard({ code: CODE });
    expect(r).toMatchObject({ found: false, reason: "ambiguous" });
    expect(h.audit).not.toHaveBeenCalled();
  });
});

describe("verifyMemberCard: busca por token (regras mantidas)", () => {
  it("token que não existe → not_found, sem sócio na resposta", async () => {
    h.getView.mockResolvedValue(null);
    const r = await verifyMemberCard({ token: TOKEN });
    expect(r).toEqual({ found: false, reason: "not_found", message: "Carteirinha não encontrada." });
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("ativo → benefícios, sem data de fim, e registra só ids e situação na auditoria", async () => {
    const r = await verifyMemberCard({ token: TOKEN });
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
    const r = await verifyMemberCard({ token: TOKEN });
    expect(r).toMatchObject({ found: true, status: "suspended", hasBenefits: false, benefitsUntil: null });
  });

  it("cancelado dentro do período pago → benefícios até a data", async () => {
    h.getView.mockResolvedValue(view({ status: "cancelled", cancelledAt: new Date("2026-10-01T12:00:00Z") }));
    const r = await verifyMemberCard({ token: TOKEN });
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
    const r = await verifyMemberCard({ token: TOKEN });
    expect(r).toMatchObject({ found: true, status: "cancelled", hasBenefits: false, benefitsUntil: null });
  });

  it("pendente → reconsulta o gateway (com limite) e relê a carteirinha", async () => {
    h.getView
      .mockResolvedValueOnce(view({ status: "pending" }))
      .mockResolvedValueOnce(view({ status: "active" }));
    const r = await verifyMemberCard({ token: TOKEN });
    expect(h.sync).toHaveBeenCalledWith("m-1");
    expect(h.getView).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ found: true, status: "active", hasBenefits: true });
  });
});

describe("verifyMemberCard: minimização da resposta", () => {
  const FIELDS = ["benefitsUntil", "found", "hasBenefits", "memberSince", "name", "planName", "status"];

  it.each([
    ["por token", () => verifyMemberCard({ token: TOKEN })],
    ["por código", () => verifyMemberCard({ code: CODE })],
  ])("devolve só os campos permitidos (%s), sem contato, id interno, token nem código", async (_label, run) => {
    const r = await run();
    expect(Object.keys(r).sort()).toEqual(FIELDS.sort());
    const dump = JSON.stringify(r);
    expect(dump).not.toContain("ana.privada@exemplo.com");
    expect(dump).not.toContain("12345678909");
    expect(dump).not.toContain("11999990000");
    expect(dump).not.toContain("m-1");
    expect(dump).not.toContain(TOKEN);
    expect(dump).not.toContain("11111111");
  });
});

describe("verifyMemberCard: erros seguros", () => {
  it("falha ao consultar → erro genérico, sem detalhe interno", async () => {
    h.getView.mockRejectedValue(new Error(`SELECT * FROM members WHERE member_card_token = '${TOKEN}'`));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await verifyMemberCard({ token: TOKEN });
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

  it("falha na busca por código → erro genérico, sem o código nem a consulta no log", async () => {
    h.getViewByCode.mockRejectedValue(
      new Error("select ... where lower(member_card_token) like '11111111%'")
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await verifyMemberCard({ code: CODE });
    expect(r).toEqual({
      found: false,
      reason: "error",
      message: "Não foi possível consultar a carteirinha. Tente de novo.",
    });
    expect(JSON.stringify(r)).not.toContain("like");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("11111111");
    spy.mockRestore();
  });

  it("falha na sincronização de pendente não derruba a conferência", async () => {
    h.getView
      .mockResolvedValueOnce(view({ status: "pending" }))
      .mockResolvedValueOnce(view({ status: "pending" }));
    h.sync.mockRejectedValue(new Error("gateway fora"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await verifyMemberCard({ token: TOKEN });
    expect(r).toMatchObject({ found: true, status: "pending", hasBenefits: false });
    spy.mockRestore();
  });
});
