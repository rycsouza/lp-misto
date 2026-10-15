import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Mural dos sócios na área logada: updateMyWallName exige sessão, valida o payload
 * (zod estrito), aplica limite e grava SÓ o campo wallName no sócio do e-mail da
 * sessão. getMyMembership devolve o nome e o nome no mural do próprio sócio.
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const OTHER_MEMBER_ID = "9a9f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e99";

const h = vi.hoisted(() => ({
  results: [] as unknown[],
  session: null as unknown,
  limited: false,
  updates: [] as Record<string, unknown>[],
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
    return {
      select: () => chain,
      update: () => ({
        set: (values: Record<string, unknown>) => {
          h.updates.push(values);
          return { where: async () => undefined };
        },
      }),
    };
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
vi.mock("@/app/actions/membership", () => ({
  getPublicMembershipPlans: async () => [],
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { getMyMembership, updateMyWallName } from "./account";

const SESSION = { id: "a-1", email: "titular@example.com", name: "Titular", whatsapp: "67999998888", emailVerifiedAt: new Date(), passwordChangedAt: new Date(1000) };
const MEMBER_ROW = {
  id: MEMBER_ID,
  name: "Ana Maria Silva",
  status: "active",
  planId: "p-1",
  pendingPlanId: null,
  memberCardToken: null,
  nextBillingDate: null,
  subscriptionId: null,
  gatewaySlug: null,
  hasPaid: true,
  wallName: "Ana Maria",
};

beforeEach(() => {
  Object.assign(h, { results: [], session: null, limited: false, updates: [] });
});

describe("updateMyWallName", () => {
  it("sem sessão → recusa sem gravar nada", async () => {
    const r = await updateMyWallName({ wallName: "Ana" });
    expect(r.ok).toBe(false);
    expect(h.updates).toEqual([]);
  });

  it("payload inválido (HTML, emoji, URL, vazio, tipo errado) → recusa sem gravar", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW], [MEMBER_ROW], [MEMBER_ROW], [MEMBER_ROW], [MEMBER_ROW]];
    for (const bad of ["<script>x</script>", "😀 Ana", "https://ana.example", "   ", 42 as never]) {
      const r = await updateMyWallName({ wallName: bad as never });
      expect(r.ok).toBe(false);
    }
    expect((await updateMyWallName(undefined as never)).ok).toBe(false);
    expect(h.updates).toEqual([]);
  });

  it("campos extras (ex.: id de outro sócio, status) → recusa: payload é estrito", async () => {
    h.session = SESSION;
    const r = await updateMyWallName({ wallName: "Ana", id: OTHER_MEMBER_ID, status: "active" } as never);
    expect(r.ok).toBe(false);
    expect(h.updates).toEqual([]);
  });

  it("limite de tentativas atingido → recusa sem gravar", async () => {
    h.session = SESSION;
    h.limited = true;
    const r = await updateMyWallName({ wallName: "Ana" });
    expect(r.ok).toBe(false);
    expect(h.updates).toEqual([]);
  });

  it("conta sem sócio → recusa sem gravar", async () => {
    h.session = SESSION;
    h.results = [[]];
    const r = await updateMyWallName({ wallName: "Ana" });
    expect(r).toEqual({ ok: false, error: "Você não tem assinatura de sócio." });
    expect(h.updates).toEqual([]);
  });

  it("grava só o campo wallName, normalizado, no sócio da sessão", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW]];
    const r = await updateMyWallName({ wallName: "  Ana   Maria  " });
    expect(r.ok).toBe(true);
    expect(h.updates).toEqual([{ wallName: "Ana Maria" }]);
  });

  it("sair do mural (null) grava null, e só isso", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW]];
    const r = await updateMyWallName({ wallName: null });
    expect(r).toMatchObject({ ok: true, wallName: null });
    expect(h.updates).toEqual([{ wallName: null }]);
  });
});

describe("getMyMembership — nome no mural do próprio sócio", () => {
  it("devolve o nome cadastrado e o nome no mural", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW], [{ id: "p-1", name: "Elite", priceCents: 7990 }]];
    const r = await getMyMembership();
    expect(r.ok).toBe(true);
    expect(r.member).toMatchObject({ name: "Ana Maria Silva", wallName: "Ana Maria", status: "active" });
  });

  it("sem nome no mural → wallName null (padrão: não aparece)", async () => {
    h.session = SESSION;
    h.results = [[{ ...MEMBER_ROW, wallName: null }], [{ id: "p-1", name: "Elite", priceCents: 7990 }]];
    const r = await getMyMembership();
    expect(r.member).toMatchObject({ wallName: null });
  });
});
