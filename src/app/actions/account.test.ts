import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Área logada: respostas genéricas (sem enumeração de e-mails), login só com
 * e-mail confirmado, redefinição presa à versão da senha, e os dados (pedidos,
 * sócio) SEMPRE pelo e-mail da sessão — nunca por algo que o client envia.
 */
const AID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const h = vi.hoisted(() => ({
  results: [] as unknown[],
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
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
  return { select: () => chain, insert: () => chain, update: () => chain };
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
} from "./account";
import { hashPassword } from "@/lib/accounts/password";
import { signAccountToken } from "@/lib/accounts/tokens";

const ME = { id: AID, email: "titular@example.com", name: "Titular", whatsapp: null, emailVerifiedAt: new Date(), passwordChangedAt: new Date(1000) };

beforeEach(() => {
  process.env.TICKET_SIGNING_SECRET = "segredo-de-teste-com-tamanho-suficiente";
  Object.assign(h, { results: [], inserts: [], updates: [], emails: [], sessionStarted: [], session: null, limited: false, ordersFor: [], cancelled: [] });
});

describe("signupAccount", () => {
  it("e-mail novo → cria (e-mail minúsculo, senha com hash) e envia confirmação", async () => {
    h.results = [[], [{ id: AID, name: "Titular", passwordChangedAt: new Date(1000) }]];
    const r = await signupAccount({ name: "Titular", email: " Titular@Example.com ", password: "uma-senha-boa" });
    expect(r.ok).toBe(true);
    expect(h.inserts[0]).toMatchObject({ email: "titular@example.com", name: "Titular" });
    expect(String(h.inserts[0].passwordHash)).toMatch(/^\$2[aby]\$12\$/);
    expect(h.emails).toEqual([{ kind: "verify", to: "titular@example.com" }]);
    expect(h.sessionStarted).toEqual([]); // só entra depois de confirmar
  });

  it("e-mail que JÁ tem conta → mesma resposta; dono recebe e-mail, nada é criado", async () => {
    h.results = [[{ id: AID, name: "T", passwordHash: "x", emailVerifiedAt: new Date(), passwordChangedAt: new Date(1) }]];
    const novo = await signupAccount({ name: "Titular", email: "titular@example.com", password: "uma-senha-boa" });
    expect(h.inserts).toEqual([]);
    expect(h.emails).toEqual([{ kind: "exists", to: "titular@example.com" }]);
    h.results = [[], [{ id: AID, name: "T", passwordChangedAt: new Date(1) }]];
    const outro = await signupAccount({ name: "Titular", email: "novo@example.com", password: "uma-senha-boa" });
    expect(novo.message).toBe(outro.message);
  });

  it("senha fraca / e-mail inválido / honeypot", async () => {
    expect((await signupAccount({ name: "T T", email: "a@b.com", password: "123" })).ok).toBe(false);
    expect((await signupAccount({ name: "T T", email: "nao-email", password: "uma-senha-boa" })).ok).toBe(false);
    expect((await signupAccount({ name: "T T", email: "a@b.com", password: "uma-senha-boa", _hp: "bot" })).ok).toBe(true);
    expect(h.inserts).toEqual([]);
  });
});

describe("loginAccount", () => {
  it("senha errada e e-mail inexistente → MESMA mensagem", async () => {
    h.results = [[{ id: AID, name: "T", passwordHash: await hashPassword("certa-senha-1"), emailVerifiedAt: new Date(), passwordChangedAt: new Date(1) }]];
    const errada = await loginAccount({ email: "titular@example.com", password: "errada-senha" });
    h.results = [[]];
    const inexistente = await loginAccount({ email: "ninguem@example.com", password: "errada-senha" });
    expect(errada).toEqual(inexistente);
    expect(h.sessionStarted).toEqual([]);
  });

  it("e-mail não confirmado → não entra; reenvia a confirmação", async () => {
    h.results = [[{ id: AID, name: "T", passwordHash: await hashPassword("certa-senha-1"), emailVerifiedAt: null, passwordChangedAt: new Date(1) }]];
    const r = await loginAccount({ email: "titular@example.com", password: "certa-senha-1" });
    expect(r).toMatchObject({ ok: false, needsVerification: true });
    expect(h.emails[0].kind).toBe("verify");
    expect(h.sessionStarted).toEqual([]);
  });

  it("confirmado + senha certa → abre sessão", async () => {
    h.results = [[{ id: AID, name: "T", passwordHash: await hashPassword("certa-senha-1"), emailVerifiedAt: new Date(), passwordChangedAt: new Date(1) }]];
    expect((await loginAccount({ email: "titular@example.com", password: "certa-senha-1" })).ok).toBe(true);
    expect(h.sessionStarted).toEqual([AID]);
  });

  it("limite de tentativas", async () => {
    h.limited = true;
    expect((await loginAccount({ email: "titular@example.com", password: "x" })).ok).toBe(false);
  });
});

describe("senha esquecida / redefinição", () => {
  it("pedir redefinição responde igual com ou sem conta", async () => {
    h.results = [[]];
    const sem = await requestPasswordReset({ email: "ninguem@example.com" });
    h.results = [[{ id: AID, name: "T", passwordHash: "x", emailVerifiedAt: new Date(), passwordChangedAt: new Date(1) }]];
    const com = await requestPasswordReset({ email: "titular@example.com" });
    expect(sem).toEqual(com);
    expect(h.emails).toEqual([{ kind: "reset", to: "titular@example.com" }]);
  });

  it("link de uma versão de senha antiga (já usado) é recusado", async () => {
    const t = await signAccountToken("reset", { aid: AID, pwv: 1000 }, "clube-a");
    h.results = [[{ id: AID, email: "titular@example.com", passwordChangedAt: new Date(2000), emailVerifiedAt: null }]];
    expect((await resetPassword({ token: t!, password: "nova-senha-boa" })).ok).toBe(false);
    expect(h.updates).toEqual([]);
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
    expect((await changeMyPlan({ planId: AID, method: "pix" })).ok).toBe(false);
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
    expect((await changeMyPlan({ planId: "nao-uuid", method: "pix" })).ok).toBe(false);
    expect((await changeMyPlan({ planId: AID, method: "boleto" as "pix" })).ok).toBe(false);
  });
});
