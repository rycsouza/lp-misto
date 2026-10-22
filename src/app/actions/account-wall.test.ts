import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Mural dos sócios na área logada: setMyWallOptIn liga/desliga o próprio nome (o da
 * conta, nunca texto do client), exige sessão, valida o payload (zod estrito), aplica
 * limite e grava SÓ wallName no sócio do e-mail da sessão. updateMyProfile acompanha
 * o mural quando o nome da conta muda. getMyMembership devolve os nomes do próprio sócio.
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const OTHER_MEMBER_ID = "9a9f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e99";

const h = vi.hoisted(() => ({
  results: [] as unknown[],
  session: null as unknown,
  limited: false,
  updates: [] as Record<string, unknown>[],
  failWallWrite: false,
  plansPublic: [] as unknown[],
  planChange: { ok: false, error: "not_found" } as unknown,
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
            where: async () => {
              if (h.failWallWrite && "wallName" in values) throw new Error("conexão perdida");
            },
          };
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
  getPublicMembershipPlans: async () => h.plansPublic,
}));
vi.mock("@/lib/payment/card-ratelimit", () => ({
  checkCardAttemptLimit: async () => true,
  MEMBER_CARD_RATE_LIMIT_ERROR: "LIMITE",
}));
vi.mock("@/lib/membership/plan-change", () => ({
  changeMemberPlan: async () => h.planChange,
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { changeMyPlan, getMyMembership, setMyWallOptIn, updateMyProfile } from "./account";

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
  Object.assign(h, { results: [], session: null, limited: false, updates: [], failWallWrite: false });
});

describe("setMyWallOptIn — liga/desliga o nome da conta", () => {
  it("sem sessão → recusa sem gravar nada", async () => {
    const r = await setMyWallOptIn({ optIn: true });
    expect(r.ok).toBe(false);
    expect(h.updates).toEqual([]);
  });

  it("payload inválido ou com campo extra (nome livre, id de outro sócio, tipo errado) → recusa sem gravar", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW], [MEMBER_ROW], [MEMBER_ROW], [MEMBER_ROW]];
    // Nome enviado pelo client: o payload é estrito e não aceita texto livre.
    expect((await setMyWallOptIn({ optIn: true, wallName: "Hacker" } as never)).ok).toBe(false);
    expect((await setMyWallOptIn({ optIn: true, wallName: "<script>x</script>" } as never)).ok).toBe(false);
    expect((await setMyWallOptIn({ optIn: true, id: OTHER_MEMBER_ID } as never)).ok).toBe(false);
    expect((await setMyWallOptIn({ optIn: "sim" } as never)).ok).toBe(false);
    expect((await setMyWallOptIn(undefined as never)).ok).toBe(false);
    expect(h.updates).toEqual([]);
  });

  it("limite de tentativas atingido → recusa sem gravar", async () => {
    h.session = SESSION;
    h.limited = true;
    const r = await setMyWallOptIn({ optIn: true });
    expect(r.ok).toBe(false);
    expect(h.updates).toEqual([]);
  });

  it("nome da conta que não pode aparecer → erro orientando a corrigir em Meus dados, sem gravar", async () => {
    h.session = { ...SESSION, name: "Ana <b>Silva</b>" };
    h.results = [[MEMBER_ROW]];
    const r = await setMyWallOptIn({ optIn: true });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Meus dados");
    expect(r.error).not.toContain("<b>");
    expect(h.updates).toEqual([]);
  });

  it("nome da conta longo demais (mais de 40 caracteres) → erro, sem gravar", async () => {
    h.session = { ...SESSION, name: "a".repeat(41) };
    h.results = [[MEMBER_ROW]];
    expect((await setMyWallOptIn({ optIn: true })).ok).toBe(false);
    expect(h.updates).toEqual([]);
  });

  it("conta sem sócio → recusa sem gravar", async () => {
    h.session = SESSION;
    h.results = [[]];
    const r = await setMyWallOptIn({ optIn: true });
    expect(r).toEqual({ ok: false, error: "Você não tem assinatura de sócio." });
    expect(h.updates).toEqual([]);
  });

  it("liga → grava o NOME DA CONTA (normalizado) no sócio da sessão, e só isso", async () => {
    h.session = { ...SESSION, name: "  Ana   Maria  " };
    h.results = [[MEMBER_ROW]];
    const r = await setMyWallOptIn({ optIn: true });
    expect(r).toMatchObject({ ok: true, wallName: "Ana Maria" });
    expect(h.updates).toEqual([{ wallName: "Ana Maria" }]);
  });

  it("desliga → grava NULL (sai do mural), e só isso", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW]];
    const r = await setMyWallOptIn({ optIn: false });
    expect(r).toMatchObject({ ok: true, wallName: null });
    expect(h.updates).toEqual([{ wallName: null }]);
  });

  it("falha ao gravar → erro genérico, sem detalhe interno", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW]];
    h.failWallWrite = true;
    const r = await setMyWallOptIn({ optIn: true });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("conexão perdida");
  });
});

describe("updateMyProfile — o nome no mural acompanha o nome da conta", () => {
  it("sócio no mural → o nome exibido vira o novo nome da conta", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW]];
    const r = await updateMyProfile({ name: "Ana Clara Souza" });
    expect(r).toEqual({ ok: true, message: "Dados atualizados." });
    expect(h.updates).toEqual([{ name: "Ana Clara Souza" }, { wallName: "Ana Clara Souza" }]);
  });

  it("sócio no mural + novo nome que não pode aparecer → sai do mural e avisa", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW]];
    const r = await updateMyProfile({ name: "Ana <b>" });
    expect(r.ok).toBe(true);
    expect(r.message).toContain("saiu do Mural dos Sócios");
    expect(h.updates).toEqual([{ name: "Ana <b>" }, { wallName: null }]);
  });

  it("sócio que NÃO está no mural → o mural não é tocado", async () => {
    h.session = SESSION;
    h.results = [[{ ...MEMBER_ROW, wallName: null }]];
    const r = await updateMyProfile({ name: "Ana Clara Souza" });
    expect(r).toEqual({ ok: true, message: "Dados atualizados." });
    expect(h.updates).toEqual([{ name: "Ana Clara Souza" }]);
  });

  it("conta sem sócio → só atualiza o nome da conta", async () => {
    h.session = SESSION;
    h.results = [[]];
    await updateMyProfile({ name: "Ana Clara Souza" });
    expect(h.updates).toEqual([{ name: "Ana Clara Souza" }]);
  });

  it("falha ao sincronizar o mural → o nome da conta é salvo, aviso genérico sem detalhe interno", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW]];
    h.failWallWrite = true;
    const r = await updateMyProfile({ name: "Ana Clara Souza" });
    expect(r.ok).toBe(true);
    expect(r.message).toContain("salve de novo");
    expect(JSON.stringify(r)).not.toContain("conexão perdida");
    expect(h.updates[0]).toEqual({ name: "Ana Clara Souza" });
  });
});

describe("getMyMembership — nome no mural do próprio sócio", () => {
  it("devolve o nome cadastrado e o nome no mural", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW], [{ id: "p-1", name: "Elite", priceCents: 7990 }]];
    const r = await getMyMembership();
    expect(r.ok).toBe(true);
    expect(r.member).toMatchObject({ name: "Ana Maria Silva", wallName: "Ana Maria", accountName: "Titular", status: "active" });
  });

  it("sem nome no mural → wallName null (padrão: não aparece)", async () => {
    h.session = SESSION;
    h.results = [[{ ...MEMBER_ROW, wallName: null }], [{ id: "p-1", name: "Elite", priceCents: 7990 }]];
    const r = await getMyMembership();
    expect(r.member).toMatchObject({ wallName: null });
  });
});

describe("sócio empresarial (CNPJ) — mural, conta e troca de plano", () => {
  const PJ_ROW = { ...MEMBER_ROW, cnpj: "11222333000181", companyName: "Padaria Bom Pão Ltda", wallName: null };
  const PLAN_ID = "1b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
  const CARD = {
    holderName: "TITULAR EXEMPLO",
    number: "4000000000000010",
    expiryMonth: "12",
    expiryYear: "2030",
    ccv: "123",
    postalCode: "01001000",
    addressNumber: "1",
  };

  beforeEach(() => {
    h.plansPublic = [];
    h.planChange = { ok: false, error: "not_found" };
  });

  it("liga o mural → grava a RAZÃO SOCIAL cadastrada (não o nome da conta)", async () => {
    h.session = SESSION;
    h.results = [[PJ_ROW]];
    const r = await setMyWallOptIn({ optIn: true });
    expect(r).toMatchObject({ ok: true, wallName: "Padaria Bom Pão Ltda" });
    expect(h.updates).toEqual([{ wallName: "Padaria Bom Pão Ltda" }]);
  });

  it("razão social que não pode aparecer → recusa, sem gravar nada", async () => {
    h.session = SESSION;
    h.results = [[{ ...PJ_ROW, companyName: "<b>Loja</b>" }]];
    const r = await setMyWallOptIn({ optIn: true });
    expect(r.ok).toBe(false);
    expect(h.updates).toEqual([]);
  });

  it("trocar o nome da conta NÃO muda o nome da empresa no mural", async () => {
    h.session = SESSION;
    h.results = [[{ ...PJ_ROW, wallName: "Padaria Bom Pão Ltda" }]];
    const r = await updateMyProfile({ name: "Ana Clara Souza" });
    expect(r).toEqual({ ok: true, message: "Dados atualizados." });
    expect(h.updates).toEqual([{ name: "Ana Clara Souza" }]);
  });

  it("Meu plano: a troca mostra só planos do mesmo público (CNPJ) e nunca o número do CNPJ", async () => {
    h.session = SESSION;
    h.plansPublic = [
      { id: "p-pf", name: "Carcará", priceCents: 4990, audience: "pf" },
      { id: "p-pj", name: "Empresarial", priceCents: 24900, audience: "pj" },
    ];
    h.results = [[{ ...PJ_ROW, wallName: "Padaria Bom Pão Ltda" }], [{ id: "p-pj", name: "Empresarial", priceCents: 24900 }]];
    const r = await getMyMembership();
    expect(r.ok).toBe(true);
    expect(r.member).toMatchObject({ isCompany: true, wallSourceName: "Padaria Bom Pão Ltda" });
    expect(r.plans?.map((p) => p.id)).toEqual(["p-pj"]);
    expect(JSON.stringify(r)).not.toContain("11222333000181");
  });

  it("troca pf ↔ pj é bloqueada com a orientação de cancelar e fazer nova adesão", async () => {
    h.session = SESSION;
    h.results = [[MEMBER_ROW]];
    h.planChange = { ok: false, error: "audience_mismatch" };
    const r = await changeMyPlan({ planId: PLAN_ID, asaasCardData: CARD });
    expect(r).toEqual({
      ok: false,
      error: "Para mudar entre plano pessoal e empresarial, cancele e faça uma nova adesão.",
    });
  });
});
