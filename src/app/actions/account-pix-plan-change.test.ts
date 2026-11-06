import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Troca de plano no Pix Automático pela área logada: exige sessão, valida o payload (zod
 * estrito), aplica limite e opera SÓ sobre o sócio do e-mail da sessão (o id do sócio nunca
 * vem do client).
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const PLAN_ID = "2d8f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e71";

const h = vi.hoisted(() => ({
  results: [] as unknown[],
  session: null as unknown,
  limited: false,
  starts: [] as { memberId: string; newPlanId: string }[],
  startResult: { ok: true } as Record<string, unknown>,
  statusCalls: [] as [string, string][],
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
vi.mock("@/lib/membership/pix-plan-change", () => ({
  startPixAutomaticPlanChange: async (p: { memberId: string; newPlanId: string }) => {
    h.starts.push(p);
    return h.startResult;
  },
  pixPlanChangeStatus: async (memberId: string, planId: string) => {
    h.statusCalls.push([memberId, planId]);
    return "pending";
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { changeMyPlanPixAutomatic, getMyPixPlanChangeStatus } from "./account";

const SESSION = { id: "acc-1", email: "titular@example.com", whatsapp: "11900000000", name: "Titular" };

beforeEach(() => {
  h.results = [];
  h.session = SESSION;
  h.limited = false;
  h.starts = [];
  h.startResult = {
    ok: true,
    planName: "Ouro",
    startsOn: "2026-12-20",
    pix: { payload: "000201", imageBase64: null, expiresAt: null },
  };
  h.statusCalls = [];
});

describe("changeMyPlanPixAutomatic", () => {
  it("sem sessão: recusa sem tocar o sócio", async () => {
    h.session = null;
    expect(await changeMyPlanPixAutomatic({ planId: PLAN_ID })).toEqual({
      ok: false,
      error: "Sua sessão expirou. Entre novamente.",
    });
    expect(h.starts).toEqual([]);
  });

  it("payload inválido ou com campos extras (ex.: memberId de outro sócio): recusa", async () => {
    for (const bad of [{ planId: "x" }, { planId: PLAN_ID, memberId: MEMBER_ID }, {}]) {
      expect((await changeMyPlanPixAutomatic(bad as never)).ok).toBe(false);
    }
    expect(h.starts).toEqual([]);
  });

  it("limite de tentativas: recusa", async () => {
    h.limited = true;
    expect((await changeMyPlanPixAutomatic({ planId: PLAN_ID })).ok).toBe(false);
    expect(h.starts).toEqual([]);
  });

  it("usa o sócio do e-mail da sessão e devolve o QR", async () => {
    h.results = [[{ id: MEMBER_ID, status: "active" }]];
    const r = await changeMyPlanPixAutomatic({ planId: PLAN_ID });
    expect(r).toEqual({ ok: true, planName: "Ouro", startsOn: "2026-12-20", pix: { payload: "000201", imageBase64: null, expiresAt: null } });
    expect(h.starts).toEqual([{ memberId: MEMBER_ID, newPlanId: PLAN_ID }]);
  });

  it("conta sem sócio: recusa", async () => {
    h.results = [[]];
    expect(await changeMyPlanPixAutomatic({ planId: PLAN_ID })).toEqual({ ok: false, error: "Você não tem assinatura de sócio." });
  });

  it("erro do módulo vira mensagem amigável", async () => {
    h.results = [[{ id: MEMBER_ID }]];
    h.startResult = { ok: false, error: "not_pix_automatic" };
    expect(await changeMyPlanPixAutomatic({ planId: PLAN_ID })).toEqual({
      ok: false,
      error: "Sua assinatura é no cartão: troque o plano pelo cartão.",
    });
  });
});

describe("getMyPixPlanChangeStatus", () => {
  it("sem sessão ou payload inválido: recusa", async () => {
    h.session = null;
    expect((await getMyPixPlanChangeStatus({ planId: PLAN_ID })).ok).toBe(false);
    h.session = SESSION;
    expect((await getMyPixPlanChangeStatus({ planId: "x" })).ok).toBe(false);
    expect(h.statusCalls).toEqual([]);
  });

  it("consulta só o sócio da sessão; no limite responde 'pending' sem reconsultar o gateway", async () => {
    h.results = [[{ id: MEMBER_ID }]];
    expect(await getMyPixPlanChangeStatus({ planId: PLAN_ID })).toEqual({ ok: true, status: "pending" });
    expect(h.statusCalls).toEqual([[MEMBER_ID, PLAN_ID]]);
    h.limited = true;
    h.results = [[{ id: MEMBER_ID }]];
    expect(await getMyPixPlanChangeStatus({ planId: PLAN_ID })).toEqual({ ok: true, status: "pending" });
    expect(h.statusCalls).toHaveLength(1);
  });
});
