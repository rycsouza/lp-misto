import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Mural dos sócios no servidor:
 * - signupMember grava no mural SÓ com opt-in (padrão: NÃO aparece), e o nome que
 *   aparece é sempre o do cadastro; qualquer nome enviado pelo client é ignorado;
 * - removeMemberFromWallAdmin (moderação) exige o módulo "socios", valida o id,
 *   tira só o nome e audita sem registrar o nome;
 * - o detalhe admin mostra o nome no mural.
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const PLAN_ID = "1b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";

const h = vi.hoisted(() => ({
  results: [] as unknown[],
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  dbUsed: false,
  session: null as unknown,
  audits: [] as unknown[][],
}));

function fakeDb(): unknown {
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, prop) => {
      if (prop === "then") {
        const value = h.results.length ? h.results.shift() : [];
        return (resolve: (v: unknown) => void) => resolve(value);
      }
      if (prop === "set") {
        return (v: Record<string, unknown>) => {
          h.updates.push(v);
          return chain;
        };
      }
      if (prop === "values") {
        return (v: Record<string, unknown>) => {
          h.inserts.push(v);
          return chain;
        };
      }
      return () => chain;
    },
    apply: () => chain,
  });
  return { select: () => chain, insert: () => chain, update: () => chain };
}

vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    h.dbUsed = true;
    return fakeDb();
  },
}));
vi.mock("@/lib/payment/card-ratelimit", () => ({
  CARD_RATE_LIMIT_ERROR: "LIMITE",
  checkCardAttemptLimit: async () => true,
}));
vi.mock("@/lib/ratelimit", () => ({
  rateLimit: async () => ({ ok: true, remaining: 0 }),
  getClientIp: async () => "203.0.113.10",
}));
vi.mock("@/lib/membership/sync", () => ({
  syncMemberSubscription: async () => "pending",
  syncMemberById: async () => "pending",
}));
vi.mock("@/lib/payment/subscription-factory", () => ({
  getSubscriptionGateway: async () => ({
    slug: "asaas",
    gateway: {
      cancelSubscription: async () => true,
      createSubscription: async () => ({ gatewayCustomerId: "cus_1", subscriptionId: "sub_new", paymentMethod: "pix" }),
    },
  }),
}));
vi.mock("@/app/actions/admin-auth", () => ({ getAdminSession: async () => h.session }));
vi.mock("@/lib/audit", () => ({
  logAudit: async (...args: unknown[]) => {
    h.audits.push(args);
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { getAdminMemberDetail, removeMemberFromWallAdmin, signupMember } from "./membership";

const EDITOR_SOCIOS = { role: "editor", permissions: { socios: true } };
const EDITOR_OUTRO = { role: "editor", permissions: { jogos: true } };

const base = {
  name: "Titular Exemplo",
  email: "titular@example.com",
  whatsapp: "11900000000",
  cpf: "52998224725",
  planId: PLAN_ID,
};
const PLAN = [{ id: PLAN_ID, active: true, name: "Ouro", priceCents: 2990 }];

beforeEach(() => {
  Object.assign(h, { results: [], inserts: [], updates: [], dbUsed: false, session: null, audits: [] });
});

describe("signupMember — mural só com opt-in, com o nome do cadastro", () => {
  it("sem opt-in → nome NÃO é gravado (wallName null); nome livre enviado pelo client é ignorado", async () => {
    h.results = [PLAN, [], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, wallName: "Outro Nome" } as never);
    expect(r.success).toBe(true);
    expect(h.inserts[0]).toMatchObject({ wallName: null });
  });

  it("opt-in → grava o nome DO CADASTRO, normalizado", async () => {
    h.results = [PLAN, [], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, name: "  Ana   Maria ", wallOptIn: true });
    expect(r.success).toBe(true);
    expect(h.inserts[0]).toMatchObject({ name: "  Ana   Maria ", wallName: "Ana Maria" });
  });

  it("opt-in ignora qualquer wallName enviado pelo client", async () => {
    h.results = [PLAN, [], [{ id: MEMBER_ID }]];
    const r = await signupMember({ ...base, name: "Ana Maria", wallOptIn: true, wallName: "Hacker Livre" } as never);
    expect(r.success).toBe(true);
    expect(h.inserts[0]).toMatchObject({ wallName: "Ana Maria" });
    expect(JSON.stringify(h.inserts)).not.toContain("Hacker");
  });

  it("opt-in com nome do cadastro que não pode aparecer → recusa antes de gravar qualquer coisa", async () => {
    const r = await signupMember({ ...base, name: "Ana <img src=x onerror=alert(1)>", wallOptIn: true });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Desmarque a opção do mural");
    expect(r.error).not.toContain("<img");
    expect(h.inserts).toEqual([]);
    expect(h.updates).toEqual([]);
    expect(h.dbUsed).toBe(false);
  });

  it("opt-in com nome só de emojis → recusa", async () => {
    const r = await signupMember({ ...base, name: "😀😀😀", wallOptIn: true });
    expect(r.success).toBe(false);
    expect(h.inserts).toEqual([]);
  });

  it("cadastro existente (pendente) refeito COM opt-in → NÃO grava o nome (quem informa o e-mail pode não ser o titular)", async () => {
    h.results = [PLAN, [{ id: MEMBER_ID, status: "pending", subscriptionId: null, gatewaySlug: null }]];
    const r = await signupMember({ ...base, wallOptIn: true });
    expect(r.success).toBe(true);
    const profileUpdate = h.updates.find((u) => "memberCardToken" in u);
    expect(profileUpdate).toMatchObject({ status: "pending", wallName: null });
  });

  it("cadastro existente refeito sem opt-in → limpa o nome do mural", async () => {
    h.results = [PLAN, [{ id: MEMBER_ID, status: "cancelled", subscriptionId: null, gatewaySlug: null }]];
    const r = await signupMember({ ...base });
    expect(r.success).toBe(true);
    const profileUpdate = h.updates.find((u) => "memberCardToken" in u);
    expect(profileUpdate).toMatchObject({ wallName: null });
  });
});

describe("removeMemberFromWallAdmin (moderação)", () => {
  it("sessão ausente → bloqueia antes do banco", async () => {
    h.session = null;
    await expect(removeMemberFromWallAdmin(MEMBER_ID)).rejects.toThrow("Não autorizado");
    expect(h.dbUsed).toBe(false);
  });

  it("editor SEM o módulo socios → bloqueia antes do banco", async () => {
    h.session = EDITOR_OUTRO;
    await expect(removeMemberFromWallAdmin(MEMBER_ID)).rejects.toThrow("Não autorizado");
    expect(h.dbUsed).toBe(false);
    expect(h.updates).toEqual([]);
  });

  it("id inválido → recusa sem tocar no banco", async () => {
    h.session = EDITOR_SOCIOS;
    expect(await removeMemberFromWallAdmin("abc")).toEqual({ success: false, error: "Sócio inválido." });
    expect(h.dbUsed).toBe(false);
  });

  it("sócio inexistente → recusa sem gravar", async () => {
    h.session = EDITOR_SOCIOS;
    h.results = [[]];
    expect(await removeMemberFromWallAdmin(MEMBER_ID)).toEqual({ success: false, error: "Sócio não encontrado." });
    expect(h.updates).toEqual([]);
  });

  it("com o módulo socios → tira só o nome e audita sem registrar o nome", async () => {
    h.session = EDITOR_SOCIOS;
    h.results = [[{ id: MEMBER_ID }]];
    const r = await removeMemberFromWallAdmin(MEMBER_ID);
    expect(r).toEqual({ success: true });
    expect(h.updates).toEqual([{ wallName: null }]);
    expect(h.audits).toEqual([["member_wall_remove", "member", MEMBER_ID]]);
    expect(JSON.stringify(h.audits)).not.toMatch(/Ana/);
  });
});

describe("detalhe admin do sócio", () => {
  it("o detalhe admin traz o nome no mural do sócio", async () => {
    h.session = EDITOR_SOCIOS;
    h.results = [
      [
        {
          id: MEMBER_ID,
          name: "Ana",
          email: "ana@example.com",
          whatsapp: null,
          cpf: null,
          status: "active",
          createdAt: new Date("2026-01-01"),
          nextBillingDate: null,
          cancelledAt: null,
          trialEndsAt: null,
          hasPaid: true,
          wallName: "Ana Maria",
          gatewaySlug: null,
          subscriptionId: null,
          memberCardToken: null,
          planName: "Elite",
          planPriceCents: 7990,
        },
      ],
    ];
    const d = await getAdminMemberDetail(MEMBER_ID);
    expect(d?.wallName).toBe("Ana Maria");
  });
});
