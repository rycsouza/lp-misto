import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Actions do ingresso grátis na área logada: exigem sessão, validam o gameId com
 * zod, aplicam limite e operam SÓ sobre o sócio do e-mail da sessão.
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const OTHER_MEMBER_ID = "9a9f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e99";
const GAME_ID = "2d8f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e71";

const h = vi.hoisted(() => ({
  results: [] as unknown[],
  session: null as unknown,
  limited: false,
  redeemCalls: [] as { member: unknown; account: unknown; gameId: string }[],
  redeemResult: { ok: true, orderId: "o-1", message: "Ingresso resgatado!" } as unknown,
  viewCalls: 0,
  view: { eligible: false } as unknown,
}));

vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    const next = () => (h.results.length ? h.results.shift() : []);
    const chain: unknown = new Proxy(function () {}, {
      get: (_t, prop) => {
        if (prop === "then") return (res: (v: unknown) => void) => res(next());
        return () => chain;
      },
      apply: () => chain,
    });
    return { select: () => chain };
  },
}));
vi.mock("@/lib/accounts/session", () => ({
  getCustomerAccount: async () => h.session,
  startAccountSession: async () => true,
  endAccountSession: async () => {},
}));
vi.mock("@/lib/ratelimit", () => ({
  getClientIp: async () => "203.0.113.10",
  rateLimit: async () => ({ ok: !h.limited, remaining: 0 }),
}));
vi.mock("@/lib/base-url", () => ({
  getCurrentTenantSlug: async () => "clube-a",
  getAppBaseUrl: async () => "https://clube.example",
}));
vi.mock("@/lib/membership/free-tickets", () => ({
  getMyFreeTicketsView: async () => {
    h.viewCalls++;
    return h.view;
  },
  redeemFreeTicket: async (member: unknown, account: unknown, gameId: string) => {
    h.redeemCalls.push({ member, account, gameId });
    return h.redeemResult;
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { getMyFreeTickets, redeemMyFreeTicket } from "./account";

const SESSION = { id: "a-1", email: "titular@example.com", name: "Titular", whatsapp: "67999998888", emailVerifiedAt: new Date(), passwordChangedAt: new Date(1000) };
const MEMBER_ROW = { id: MEMBER_ID, name: "Sócio", status: "active", planId: "p-1", pendingPlanId: null, memberCardToken: null, nextBillingDate: null, subscriptionId: null, gatewaySlug: null, hasPaid: true };

beforeEach(() => {
  Object.assign(h, { results: [], session: null, limited: false, redeemCalls: [], redeemResult: { ok: true, orderId: "o-1", message: "Ingresso resgatado!" }, viewCalls: 0, view: { eligible: false } });
});

describe("redeemMyFreeTicket", () => {
  it("sem sessão → recusa sem tocar no sócio nem resgatar", async () => {
    const r = await redeemMyFreeTicket({ gameId: GAME_ID });
    expect(r.ok).toBe(false);
    expect(h.redeemCalls).toEqual([]);
  });

  it("payload inválido (gameId não é UUID) → recusa", async () => {
    h.session = SESSION;
    const r = await redeemMyFreeTicket({ gameId: "abc" });
    expect(r).toMatchObject({ ok: false, error: "Jogo inválido." });
    expect(h.redeemCalls).toEqual([]);
  });

  it("payload sem gameId ou não-objeto → recusa", async () => {
    h.session = SESSION;
    expect((await redeemMyFreeTicket({} as never)).ok).toBe(false);
    expect((await redeemMyFreeTicket(null as never)).ok).toBe(false);
    expect(h.redeemCalls).toEqual([]);
  });

  it("limite de tentativas atingido → recusa", async () => {
    h.session = SESSION;
    h.limited = true;
    const r = await redeemMyFreeTicket({ gameId: GAME_ID });
    expect(r.ok).toBe(false);
    expect(h.redeemCalls).toEqual([]);
  });

  it("conta sem sócio → recusa sem resgatar", async () => {
    h.session = SESSION;
    h.results = [[]];
    const r = await redeemMyFreeTicket({ gameId: GAME_ID });
    expect(r).toEqual({ ok: false, error: "Você não tem assinatura de sócio." });
    expect(h.redeemCalls).toEqual([]);
  });

  it("memberId enviado pelo client é ignorado: o sócio vem da sessão", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW]];
    const r = await redeemMyFreeTicket({ gameId: GAME_ID, memberId: OTHER_MEMBER_ID } as never);
    expect(r).toEqual({ ok: true, message: "Ingresso resgatado!", orderId: "o-1" });
    expect(h.redeemCalls).toHaveLength(1);
    expect(h.redeemCalls[0].gameId).toBe(GAME_ID);
    expect(h.redeemCalls[0].member).toMatchObject({ id: MEMBER_ID });
    expect(h.redeemCalls[0].account).toMatchObject({ email: "titular@example.com", whatsapp: "67999998888" });
  });

  it("repassa a recusa do domínio (ex.: limite atingido) sem vazar detalhes", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW]];
    h.redeemResult = { ok: false, error: "Limite atingido para este jogo." };
    const r = await redeemMyFreeTicket({ gameId: GAME_ID });
    expect(r).toEqual({ ok: false, error: "Limite atingido para este jogo." });
  });
});

describe("getMyFreeTickets", () => {
  it("sem sessão → ok false, sem consultar nada", async () => {
    const r = await getMyFreeTickets();
    expect(r.ok).toBe(false);
    expect(h.viewCalls).toBe(0);
  });

  it("conta sem sócio → não elegível", async () => {
    h.session = SESSION;
    h.results = [[]];
    const r = await getMyFreeTickets();
    expect(r).toEqual({ ok: true, eligible: false });
    expect(h.viewCalls).toBe(0);
  });

  it("sócio → devolve a visão calculada pelo domínio", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW]];
    h.view = { eligible: true, planName: "Elite", perGame: 1, games: [] };
    const r = await getMyFreeTickets();
    expect(r).toEqual({ ok: true, eligible: true, planName: "Elite", perGame: 1, games: [] });
  });
});
