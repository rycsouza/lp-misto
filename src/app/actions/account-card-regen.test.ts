import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * "Gerar nova carteirinha" na área logada: exige sessão, rate limit (3/h por conta),
 * troca SÓ o token do sócio do e-mail da sessão (id vindo do findMyMember, nunca do
 * client), não devolve token algum e não expõe erro interno.
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const OTHER_MEMBER_ID = "9a9f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e99";
const OLD_TOKEN = "5f0d1c9e-8a7b-4c3d-9e2f-1a2b3c4d5e6f";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const h = vi.hoisted(() => ({
  results: [] as unknown[],
  session: null as unknown,
  limited: false,
  updates: [] as Record<string, unknown>[],
  failUpdate: false,
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
          return {
            where: () => ({
              returning: async () => {
                if (h.failUpdate) throw new Error("falha interna do banco: senha=xyz");
                return [{ id: MEMBER_ID }];
              },
            }),
          };
        },
      }),
    };
  },
}));
vi.mock("@/lib/membership/card-token", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/membership/card-token")>();
  return { rotateMemberCardToken: vi.fn(real.rotateMemberCardToken) };
});
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

import { regenerateMyCard } from "./account";
import { rotateMemberCardToken } from "@/lib/membership/card-token";

const SESSION = {
  id: "a-1",
  email: "titular@example.com",
  name: "Titular",
  whatsapp: "67999998888",
  emailVerifiedAt: new Date(),
  passwordChangedAt: new Date(1000),
};
const MEMBER_ROW = {
  id: MEMBER_ID,
  name: "Ana Maria Silva",
  status: "active",
  planId: "p-1",
  pendingPlanId: null,
  memberCardToken: OLD_TOKEN,
  nextBillingDate: null,
  subscriptionId: null,
  gatewaySlug: null,
  hasPaid: true,
  wallName: null,
};

beforeEach(() => {
  Object.assign(h, { results: [], session: null, limited: false, updates: [], failUpdate: false });
  vi.mocked(rotateMemberCardToken).mockClear();
});

describe("regenerateMyCard", () => {
  it("sem sessão → recusa sem tocar no sócio", async () => {
    const r = await regenerateMyCard();
    expect(r.ok).toBe(false);
    expect(rotateMemberCardToken).not.toHaveBeenCalled();
    expect(h.updates).toEqual([]);
  });

  it("conta sem sócio → recusa sem gravar nada", async () => {
    h.session = SESSION;
    h.results = [[]];
    const r = await regenerateMyCard();
    expect(r).toEqual({ ok: false, error: "Você ainda não tem carteirinha." });
    expect(h.updates).toEqual([]);
  });

  it("sócio sem carteirinha ainda (token NULL) → recusa sem criar token", async () => {
    h.session = SESSION;
    h.results = [[{ ...MEMBER_ROW, memberCardToken: null }]];
    const r = await regenerateMyCard();
    expect(r.ok).toBe(false);
    expect(h.updates).toEqual([]);
  });

  it("limite de 3 por hora atingido → recusa sem gravar", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW]];
    h.limited = true;
    const r = await regenerateMyCard();
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Tente de novo mais tarde");
    expect(rotateMemberCardToken).not.toHaveBeenCalled();
    expect(h.updates).toEqual([]);
  });

  it("troca SÓ o token do sócio do e-mail da sessão, com token novo (uuid) ≠ antigo", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW]];
    const r = await regenerateMyCard();
    expect(r.ok).toBe(true);
    expect(rotateMemberCardToken).toHaveBeenCalledTimes(1);
    expect(vi.mocked(rotateMemberCardToken).mock.calls[0][1]).toBe(MEMBER_ID);
    expect(h.updates).toHaveLength(1);
    const novo = h.updates[0].memberCardToken as string;
    expect(novo).toMatch(UUID_RE);
    expect(novo).not.toBe(OLD_TOKEN);
  });

  it("nunca devolve o token (antigo nem novo) na resposta", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW]];
    const r = await regenerateMyCard();
    const novo = h.updates[0].memberCardToken as string;
    const body = JSON.stringify(r);
    expect(body).not.toContain(OLD_TOKEN);
    expect(body).not.toContain(novo);
  });

  it("ignora qualquer id enviado pelo client: o sócio é sempre o da sessão", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW]];
    // Action sem parâmetros: o cast só simula um client malicioso mandando um id.
    const withClientId = regenerateMyCard as unknown as (input: unknown) => ReturnType<typeof regenerateMyCard>;
    const r = await withClientId({ memberId: OTHER_MEMBER_ID });
    expect(r.ok).toBe(true);
    expect(vi.mocked(rotateMemberCardToken).mock.calls[0][1]).toBe(MEMBER_ID);
    expect(vi.mocked(rotateMemberCardToken).mock.calls[0][1]).not.toBe(OTHER_MEMBER_ID);
  });

  it("falha no banco → erro genérico, sem detalhe interno", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW]];
    h.failUpdate = true;
    const r = await regenerateMyCard();
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("senha=xyz");
    expect(r.error).toBe("Área do cliente indisponível no momento. Tente mais tarde.");
  });
});
