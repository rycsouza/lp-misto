import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Área logada: login por WhatsApp + senha, conta só nasce com e-mail confirmado
 * (e, se o WhatsApp já tem cadastro de compras, o e-mail é o DESSE cadastro —
 * ninguém reivindica o telefone de outro), redefinição presa à versão da senha,
 * e os dados (pedidos, sócio) SEMPRE pelo e-mail da sessão.
 */
const AID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const CARTAO = {
  holderName: "TITULAR EXEMPLO",
  number: "4000000000000010",
  expiryMonth: "12",
  expiryYear: "2030",
  ccv: "123",
  postalCode: "01001000",
  addressNumber: "1",
};
const h = vi.hoisted(() => ({
  results: [] as unknown[],
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  deletes: 0,
  emails: [] as { kind: string; to: string }[],
  sessionStarted: [] as string[],
  session: null as unknown,
  limited: false,
  ordersFor: [] as string[],
  cancelled: [] as string[],
}));

function fakeDb(): unknown {
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, prop) => {
      if (prop === "then") {
        const value = h.results.length ? h.results.shift() : [];
        return (resolve: (v: unknown) => void) => resolve(value);
      }
      if (prop === "values") return (v: Record<string, unknown>) => { h.inserts.push(v); return chain; };
      if (prop === "set") return (v: Record<string, unknown>) => { h.updates.push(v); return chain; };
      if (prop === "catch") return () => chain;
      return () => chain;
    },
    apply: () => chain,
  });
  return { select: () => chain, insert: () => chain, update: () => chain, delete: () => { h.deletes++; return chain; } };
}

vi.mock("@/lib/db/client", () => ({ getDb: async () => fakeDb() }));
vi.mock("@/lib/ratelimit", () => ({
  getClientIp: async () => "203.0.113.10",
  rateLimit: async () => ({ ok: !h.limited, remaining: 0 }),
}));
vi.mock("@/lib/base-url", () => ({
  getCurrentTenantSlug: async () => "clube-a",
  getAppBaseUrl: async () => "https://clube.example",
}));
vi.mock("@/lib/email", () => ({
  sendAccountVerifyEmail: async (to: string) => { h.emails.push({ kind: "verify", to }); return true; },
  sendAccountResetEmail: async (to: string) => { h.emails.push({ kind: "reset", to }); return true; },
  sendAccountExistsEmail: async (to: string) => { h.emails.push({ kind: "exists", to }); return true; },
}));
vi.mock("@/lib/accounts/session", () => ({
  getCustomerAccount: async () => h.session,
  startAccountSession: async (a: { id: string }) => { h.sessionStarted.push(a.id); return true; },
  endAccountSession: async () => {},
}));
vi.mock("@/lib/orders/enrich", () => ({
  loadOrdersForVerifiedEmail: async (email: string) => { h.ordersFor.push(email); return []; },
}));
vi.mock("@/lib/membership/cancel", () => ({
  cancelMembership: async (id: string) => { h.cancelled.push(id); return { ok: true, benefitsUntil: null }; },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import {
  signupAccount,
  loginAccount,
  requestPasswordReset,
  resetPassword,
  getMyOrders,
  cancelMyMembership,
  changeMyPlan,
  getCheckoutIdentity,
  updateMyProfile,
} from "./account";
import { hashPassword } from "@/lib/accounts/password";
import { signAccountToken } from "@/lib/accounts/tokens";

const TEL = "67999998888";
const ME = { id: AID, email: "titular@example.com", name: "Titular", whatsapp: TEL as string | null, emailVerifiedAt: new Date(), passwordChangedAt: new Date(1000) };

beforeEach(() => {
  process.env.TICKET_SIGNING_SECRET = "segredo-de-teste-com-tamanho-suficiente";
  Object.assign(h, { results: [], inserts: [], updates: [], deletes: 0, emails: [], sessionStarted: [], session: null, limited: false, ordersFor: [], cancelled: [] });
});

const acc = async (over: Record<string, unknown> = {}) => ({
  id: AID, name: "T", email: "titular@example.com", whatsapp: TEL,
  passwordHash: await hashPassword("certa-senha-1"), emailVerifiedAt: new Date(), passwordChangedAt: new Date(1),
  ...over,
});

describe("signupAccount (WhatsApp + senha)", () => {
  it("WhatsApp sem cadastro → usa nome/e-mail informados, cria e envia confirmação", async () => {
    // 1) cadastro de compras do WhatsApp; 2) contas existentes; 3) insert
    h.results = [[], [], [{ id: AID, name: "Titular", passwordChangedAt: new Date(1000) }]];
    const r = await signupAccount({ whatsapp: "(67) 99999-8888", name: "Titular", email: " Titular@Example.com " });
    expect(r.ok).toBe(true);
    expect(h.inserts[0]).toMatchObject({ email: "titular@example.com", name: "Titular", whatsapp: TEL });
    // Sem senha: quem cria a senha é o dono do e-mail, pelo link (anti-sequestro pré-cadastro).
    expect(h.inserts[0].passwordHash).toBe("!");
    expect(h.emails).toEqual([{ kind: "verify", to: "titular@example.com" }]);
    expect(r.message).toContain("titu***@example.com");
    expect(h.sessionStarted).toEqual([]);
  });

  it("WhatsApp COM cadastro de compras → nome/e-mail do cadastro; o que o client manda é ignorado", async () => {
    h.results = [[{ name: "Dono Real", email: "dono@example.com" }], [], [{ id: AID, name: "Dono Real", passwordChangedAt: new Date(1) }]];
    const r = await signupAccount({ whatsapp: TEL, name: "Atacante", email: "atacante@evil.com" });
    expect(r.ok).toBe(true);
    expect(h.inserts[0]).toMatchObject({ email: "dono@example.com", name: "Dono Real", whatsapp: TEL });
    expect(h.emails).toEqual([{ kind: "verify", to: "dono@example.com" }]);
  });

  it("já existe conta CONFIRMADA → nada é criado nem alterado; o dono recebe e-mail", async () => {
    h.results = [[], [await acc()]];
    const r = await signupAccount({ whatsapp: TEL, name: "Outro", email: "outro@example.com" });
    expect(r.ok).toBe(true);
    expect(h.inserts).toEqual([]);
    expect(h.updates).toEqual([]);
    expect(h.emails).toEqual([{ kind: "exists", to: "titular@example.com" }]);
  });

  it("conta NÃO ativada não 'segura' o WhatsApp: é substituída e o link vai ao novo e-mail", async () => {
    h.results = [[], [await acc({ emailVerifiedAt: null, email: "velho@example.com" })], [{ id: AID, name: "Novo", passwordChangedAt: new Date(5) }]];
    const r = await signupAccount({ whatsapp: TEL, name: "Novo", email: "novo@example.com" });
    expect(r.ok).toBe(true);
    expect(h.updates[0]).toMatchObject({ email: "novo@example.com", whatsapp: TEL, passwordHash: "!" });
    expect(h.updates[0].passwordChangedAt).toBeInstanceOf(Date); // links antigos param de valer
    expect(h.emails).toEqual([{ kind: "verify", to: "novo@example.com" }]);
  });

  it("entradas inválidas / honeypot / limite", async () => {
    expect((await signupAccount({ whatsapp: "123", name: "T T", email: "a@b.com" })).ok).toBe(false);
    h.results = [[]];
    expect((await signupAccount({ whatsapp: TEL, name: "T T", email: "nao-email" })).ok).toBe(false);
    expect((await signupAccount({ whatsapp: TEL, name: "T T", email: "a@b.com", _hp: "bot" })).ok).toBe(true);
    h.limited = true;
    expect((await signupAccount({ whatsapp: TEL, name: "T T", email: "a@b.com" })).ok).toBe(false);
    expect(h.inserts).toEqual([]);
  });
});

describe("loginAccount (WhatsApp + senha)", () => {
  it("senha errada e WhatsApp inexistente → MESMA mensagem", async () => {
    h.results = [[await acc()]];
    const errada = await loginAccount({ login: "(67) 99999-8888", password: "errada-senha" });
    h.results = [[]];
    const inexistente = await loginAccount({ login: "(67) 98888-7777", password: "errada-senha" });
    expect(errada).toEqual(inexistente);
    expect(h.sessionStarted).toEqual([]);
  });

  it("conta antiga não ativada (com senha) → não entra; reenvia o link de criar senha", async () => {
    h.results = [[await acc({ emailVerifiedAt: null })]];
    const r = await loginAccount({ login: TEL, password: "certa-senha-1" });
    expect(r).toMatchObject({ ok: false, needsVerification: true });
    expect(h.emails[0]).toEqual({ kind: "verify", to: "titular@example.com" });
    expect(h.sessionStarted).toEqual([]);
  });

  it("confirmado + senha certa → abre sessão (aceita com DDI 55)", async () => {
    h.results = [[await acc()]];
    expect((await loginAccount({ login: "+55 67 99999-8888", password: "certa-senha-1" })).ok).toBe(true);
    expect(h.sessionStarted).toEqual([AID]);
  });

  it("conta antiga sem WhatsApp ainda entra pelo e-mail", async () => {
    h.results = [[await acc({ whatsapp: null })]];
    expect((await loginAccount({ login: "titular@example.com", password: "certa-senha-1" })).ok).toBe(true);
  });

  it("lixo / limite de tentativas", async () => {
    expect((await loginAccount({ login: "abc", password: "x" })).ok).toBe(false);
    h.limited = true;
    expect((await loginAccount({ login: TEL, password: "x" })).ok).toBe(false);
    expect(h.sessionStarted).toEqual([]);
  });
});

describe("senha esquecida / redefinição", () => {
  it("pedir redefinição pelo WhatsApp responde igual com ou sem conta; link vai ao e-mail da conta", async () => {
    h.results = [[]];
    const sem = await requestPasswordReset({ whatsapp: "(67) 98888-7777" });
    h.results = [[await acc()]];
    const com = await requestPasswordReset({ whatsapp: "(67) 99999-8888" });
    expect(sem).toEqual(com);
    expect(h.emails).toEqual([{ kind: "reset", to: "titular@example.com" }]);
  });

  it("link de uma versão de senha antiga (já usado) é recusado", async () => {
    const t = await signAccountToken("reset", { aid: AID, pwv: 1000 }, "clube-a");
    h.results = [[{ id: AID, email: "titular@example.com", passwordChangedAt: new Date(2000), emailVerifiedAt: null }]];
    expect((await resetPassword({ token: t!, password: "nova-senha-boa" })).ok).toBe(false);
    expect(h.updates).toEqual([]);
  });

  it("conta recém-criada (sem senha) nunca autentica — nem com o marcador", async () => {
    h.results = [[await acc({ passwordHash: "!", emailVerifiedAt: null })]];
    expect((await loginAccount({ login: TEL, password: "!" })).ok).toBe(false);
    h.results = [[await acc({ passwordHash: "!", emailVerifiedAt: null })]];
    expect((await loginAccount({ login: TEL, password: "qualquer-coisa" })).needsVerification).toBeUndefined();
    expect(h.sessionStarted).toEqual([]);
    expect(h.emails).toEqual([]);
  });

  it("link de ATIVAÇÃO (verify) cria a 1ª senha, ativa e abre sessão — uma vez só", async () => {
    const t = await signAccountToken("verify", { aid: AID, pwv: 1000 }, "clube-a");
    h.results = [[{ id: AID, email: "titular@example.com", passwordChangedAt: new Date(1000), emailVerifiedAt: null }]];
    expect((await resetPassword({ token: t!, password: "minha-senha-1" })).ok).toBe(true);
    expect(String(h.updates[0].passwordHash)).toMatch(/^\$2[aby]\$12\$/);
    expect(h.updates[0].emailVerifiedAt).toBeInstanceOf(Date);
    expect(h.sessionStarted).toEqual([AID]);
    // reuso: a versão de senha mudou
    h.results = [[{ id: AID, email: "titular@example.com", passwordChangedAt: new Date(2000), emailVerifiedAt: new Date() }]];
    expect((await resetPassword({ token: t!, password: "outra-senha-1" })).ok).toBe(false);
  });

  it("token de SESSÃO não serve para definir senha", async () => {
    const t = await signAccountToken("session", { aid: AID, pwv: 1000 }, "clube-a");
    expect((await resetPassword({ token: t!, password: "minha-senha-1" })).ok).toBe(false);
  });

  it("link válido → troca a senha, confirma o e-mail e abre sessão", async () => {
    const t = await signAccountToken("reset", { aid: AID, pwv: 1000 }, "clube-a");
    h.results = [[{ id: AID, email: "titular@example.com", passwordChangedAt: new Date(1000), emailVerifiedAt: null }]];
    expect((await resetPassword({ token: t!, password: "nova-senha-boa" })).ok).toBe(true);
    expect(h.updates[0]).toHaveProperty("passwordHash");
    expect(h.updates[0].emailVerifiedAt).toBeInstanceOf(Date);
    expect(h.sessionStarted).toEqual([AID]);
  });
});

describe("dados sempre pelo e-mail da SESSÃO", () => {
  it("sem sessão → nada", async () => {
    expect(await getMyOrders()).toEqual({ ok: false, orders: [] });
    expect((await cancelMyMembership()).ok).toBe(false);
    expect((await changeMyPlan({ planId: AID })).ok).toBe(false);
    expect(h.ordersFor).toEqual([]);
    expect(h.cancelled).toEqual([]);
  });

  it("pedidos usam o e-mail confirmado da conta", async () => {
    h.session = ME;
    await getMyOrders();
    expect(h.ordersFor).toEqual(["titular@example.com"]);
  });

  it("cancelar age só sobre o sócio do e-mail da conta", async () => {
    h.session = ME;
    h.results = [[{ id: "member-do-titular", status: "active" }]];
    expect((await cancelMyMembership()).ok).toBe(true);
    expect(h.cancelled).toEqual(["member-do-titular"]);
  });

  it("troca de plano valida a entrada", async () => {
    h.session = ME;
    expect((await changeMyPlan({ planId: "nao-uuid", asaasCardData: CARTAO })).ok).toBe(false);
    // Só cartão: payload com outra forma de pagamento é recusado (schema estrito).
    expect((await changeMyPlan({ planId: AID, method: "pix" } as never)).ok).toBe(false);
    expect((await changeMyPlan({ planId: AID, method: "boleto" } as never)).ok).toBe(false);
  });

  it("troca de plano sem cartão é recusada antes de qualquer consulta", async () => {
    h.session = ME;
    h.results = [[{ id: "member-do-titular", status: "active" }]];
    expect(await changeMyPlan({ planId: AID })).toEqual({ ok: false, error: "Informe os dados do cartão." });
    // Nenhuma query foi feita: a fila de resultados continua intacta.
    expect(h.results).toHaveLength(1);
    expect(h.updates).toEqual([]);
  });
});

describe("checkout: identificação automática do cliente logado", () => {
  it("sem sessão → null (checkout segue pelo WhatsApp)", async () => {
    expect(await getCheckoutIdentity()).toBeNull();
  });

  it("logado → dados da própria conta; CPF só como 'tem/não tem'", async () => {
    h.session = ME;
    h.results = [[{ cpf: "52998224725" }]];
    const r = await getCheckoutIdentity();
    expect(r).toEqual({ name: "Titular", email: "titular@example.com", whatsapp: TEL, hasCpf: true });
    expect(JSON.stringify(r)).not.toContain("52998224725");
  });
});

describe("meus dados", () => {
  it("o WhatsApp (login) não muda depois de definido", async () => {
    h.session = ME;
    await updateMyProfile({ name: "Novo Nome", whatsapp: "67911112222" });
    expect(h.updates[0]).toEqual({ name: "Novo Nome" });
  });

  it("conta antiga sem WhatsApp pode cadastrá-lo (validado)", async () => {
    h.session = { ...ME, whatsapp: null };
    expect((await updateMyProfile({ name: "Titular", whatsapp: "123" })).ok).toBe(false);
    await updateMyProfile({ name: "Titular", whatsapp: "(67) 91111-2222" });
    expect(h.updates[0]).toEqual({ name: "Titular", whatsapp: "67911112222" });
  });

  it("sem sessão → nada", async () => {
    expect((await updateMyProfile({ name: "X Y" })).ok).toBe(false);
    expect(h.updates).toEqual([]);
  });
});
