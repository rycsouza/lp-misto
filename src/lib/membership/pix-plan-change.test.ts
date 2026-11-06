import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Troca de plano no Pix Automático (início): só sócio ativo no Pix Automático, plano ativo do
 * mesmo público, opção ligada e gateway Asaas. Cria a nova autorização com início um mês após
 * o vencimento atual e grava como "em andamento" — nada do débito atual é mexido aqui.
 */
const h = vi.hoisted(() => ({
  selects: [] as unknown[][],
  updates: [] as Record<string, unknown>[],
  enabled: "true" as unknown,
  slug: "asaas",
  authInputs: [] as Record<string, unknown>[],
  createThrows: false,
  cancelled: [] as string[],
  synced: [] as string[],
}));

function fakeDb(): unknown {
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, prop) => {
      if (prop === "then") {
        const value = h.selects.length ? h.selects.shift() : [];
        return (resolve: (v: unknown) => void) => resolve(value);
      }
      return () => chain;
    },
    apply: () => chain,
  });
  return {
    select: () => chain,
    update: () => ({
      set: (v: Record<string, unknown>) => {
        h.updates.push(v);
        return { where: async () => [] };
      },
    }),
  };
}

vi.mock("@/lib/db/client", () => ({ getDb: async () => fakeDb() }));
vi.mock("@/lib/date", async (orig) => ({ ...(await orig<typeof import("@/lib/date")>()), todayBrasilia: () => "2026-11-06" }));
vi.mock("@/lib/config", () => ({
  getSiteConfig: async () => ({ membershipPixAutomaticEnabled: h.enabled, membershipProgramName: "Sócio Carcará" }),
}));
vi.mock("@/lib/payment/subscription-factory", () => ({
  getSubscriptionGateway: async () => ({
    slug: h.slug,
    gateway: {
      createPixAutomaticAuthorization: async (input: Record<string, unknown>) => {
        h.authInputs.push(input);
        if (h.createThrows) throw new Error("ASAAS 400 cpf 52998224725");
        return { gatewayCustomerId: "cus_new", authorizationId: "auth_new", qrPayload: "000201", qrImageBase64: null, expiresAt: null };
      },
    },
  }),
}));
vi.mock("./pix-automatic", async () => ({
  ...(await vi.importActual<typeof import("./pix-automatic-config")>("./pix-automatic-config")),
  pixAutomaticContractId: () => "SOCIO-TESTE",
  cancelPixAutomaticAuthorization: async (_gw: unknown, id: string) => {
    h.cancelled.push(id);
  },
  syncMemberPixAutomatic: async (id: string) => {
    h.synced.push(id);
    return "active";
  },
}));

import { pixPlanChangeStartDate, pixPlanChangeStatus, startPixAutomaticPlanChange } from "./pix-plan-change";

const MEMBER_ID = "11111111-2222-4333-8444-555555555555";
const NEW_PLAN = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const member = (over: Record<string, unknown> = {}) => ({
  id: MEMBER_ID,
  name: "Titular Exemplo",
  email: "titular@example.com",
  whatsapp: "11900000000",
  cpf: "52998224725",
  cnpj: null,
  companyName: null,
  status: "active",
  planId: "plan-1",
  paymentMethod: "pix_automatic",
  gatewaySlug: "asaas",
  nextBillingDate: new Date("2026-11-20T12:00:00-03:00"),
  pendingAuthorizationId: null,
  ...over,
});
const plan = (over: Record<string, unknown> = {}) => ({
  id: NEW_PLAN,
  name: "Ouro",
  priceCents: 4990,
  active: true,
  audience: "pf",
  ...over,
});

beforeEach(() => {
  h.selects = [];
  h.updates = [];
  h.enabled = "true";
  h.slug = "asaas";
  h.authInputs = [];
  h.createThrows = false;
  h.cancelled = [];
  h.synced = [];
});

describe("startPixAutomaticPlanChange", () => {
  it("cria a nova autorização (início 1 mês após o vencimento) e grava a troca em andamento", async () => {
    h.selects = [[member()], [plan()]];
    const r = await startPixAutomaticPlanChange({ memberId: MEMBER_ID, newPlanId: NEW_PLAN });
    expect(r).toEqual({
      ok: true,
      planName: "Ouro",
      startsOn: "2026-12-20",
      pix: { payload: "000201", imageBase64: null, expiresAt: null },
    });
    expect(h.authInputs[0]).toMatchObject({ amountCents: 4990, planName: "Ouro", startDate: "2026-12-20", cpf: "52998224725" });
    expect(h.updates).toEqual([{ pixAutomaticPendingAuthorizationId: "auth_new", pixAutomaticPendingPlanId: NEW_PLAN }]);
    // O débito atual não é tocado no início da troca.
    expect(h.cancelled).toEqual([]);
  });

  it("troca anterior ainda aguardando: encerra a autorização dela antes", async () => {
    h.selects = [[member({ pendingAuthorizationId: "auth_antiga" })], [plan()]];
    await startPixAutomaticPlanChange({ memberId: MEMBER_ID, newPlanId: NEW_PLAN });
    expect(h.cancelled).toEqual(["auth_antiga"]);
  });

  it("recusas sem chamar o gateway", async () => {
    const cases: [Record<string, unknown>, Record<string, unknown>, string][] = [
      [{ status: "suspended" }, {}, "not_active"],
      [{ paymentMethod: "card" }, {}, "not_pix_automatic"],
      [{ planId: NEW_PLAN }, {}, "same_plan"],
      [{}, { active: false }, "plan_unavailable"],
      [{}, { audience: "pj" }, "audience_mismatch"],
      [{ gatewaySlug: "mercadopago" }, {}, "unavailable"],
    ];
    for (const [m, p, error] of cases) {
      h.selects = [[member(m)], [plan(p)]];
      expect(await startPixAutomaticPlanChange({ memberId: MEMBER_ID, newPlanId: NEW_PLAN }), error).toEqual({ ok: false, error });
    }
    h.selects = [[]];
    expect(await startPixAutomaticPlanChange({ memberId: MEMBER_ID, newPlanId: NEW_PLAN })).toEqual({ ok: false, error: "not_found" });
    expect(h.authInputs).toEqual([]);
    expect(h.updates).toEqual([]);
  });

  it("opção desligada pelo admin do sistema: indisponível", async () => {
    h.enabled = "false";
    h.selects = [[member()], [plan()]];
    expect(await startPixAutomaticPlanChange({ memberId: MEMBER_ID, newPlanId: NEW_PLAN })).toEqual({ ok: false, error: "unavailable" });
    expect(h.authInputs).toEqual([]);
  });

  it("falha no gateway: erro genérico, nada gravado", async () => {
    h.createThrows = true;
    h.selects = [[member()], [plan()]];
    const r = await startPixAutomaticPlanChange({ memberId: MEMBER_ID, newPlanId: NEW_PLAN });
    expect(r).toEqual({ ok: false, error: "gateway_error" });
    expect(JSON.stringify(r)).not.toContain("529");
    expect(h.updates).toEqual([]);
  });
});

describe("pixPlanChangeStartDate", () => {
  it("um mês após o vencimento atual; vencimento passado ou ausente conta a partir de hoje", () => {
    expect(pixPlanChangeStartDate(new Date("2026-11-20T12:00:00-03:00"), "2026-11-06")).toBe("2026-12-20");
    expect(pixPlanChangeStartDate(new Date("2026-10-01T12:00:00-03:00"), "2026-11-06")).toBe("2026-12-06");
    expect(pixPlanChangeStartDate(null, "2026-11-06")).toBe("2026-12-06");
  });
});

describe("pixPlanChangeStatus", () => {
  it("em andamento: reconsulta a autorização nova e devolve 'done' quando o plano já trocou", async () => {
    h.selects = [[{ planId: "plan-1", pendingAuthorizationId: "auth_new" }], [{ planId: NEW_PLAN, pendingAuthorizationId: null }]];
    expect(await pixPlanChangeStatus(MEMBER_ID, NEW_PLAN)).toBe("done");
    expect(h.synced).toEqual(["auth_new"]);
  });

  it("ainda aguardando: 'pending'; desistiu (sem troca e sem plano novo): 'failed'", async () => {
    h.selects = [[{ planId: "plan-1", pendingAuthorizationId: "auth_new" }], [{ planId: "plan-1", pendingAuthorizationId: "auth_new" }]];
    expect(await pixPlanChangeStatus(MEMBER_ID, NEW_PLAN)).toBe("pending");
    h.selects = [[{ planId: "plan-1", pendingAuthorizationId: null }]];
    expect(await pixPlanChangeStatus(MEMBER_ID, NEW_PLAN)).toBe("failed");
  });
});
