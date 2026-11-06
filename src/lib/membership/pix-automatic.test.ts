import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Pix Automático: o sócio só muda de estado pelo que o GATEWAY diz da autorização (nunca pelo
 * corpo do webhook). Ativa na autorização ACTIVE; cancela mantendo o período pago quando o
 * pagador cancela no banco; recusa com 1º mês pago = benefício só desse mês.
 */
const h = vi.hoisted(() => ({
  member: null as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[],
  auth: { id: "auth_1", status: "CREATED", subscriptionId: null, customerId: "cus_1", startDate: "2026-12-06" } as Record<string, unknown>,
  authById: {} as Record<string, Record<string, unknown>>,
  cancelThrows: false,
  slug: "asaas",
  getCalls: 0,
  cancelledSubs: [] as string[],
  cancelledAuths: [] as string[],
  firstPayment: null as Record<string, unknown> | null,
  ledger: [] as unknown[],
  welcome: [] as string[],
  subSync: [] as string[],
}));

function fakeDb(): unknown {
  const selectChain: unknown = new Proxy(function () {}, {
    get: (_t, prop) => {
      if (prop === "then") return (resolve: (v: unknown) => void) => resolve(h.member ? [h.member] : []);
      return () => selectChain;
    },
    apply: () => selectChain,
  });
  return {
    select: () => selectChain,
    update: () => ({
      set: (values: Record<string, unknown>) => {
        h.updates.push(values);
        return { where: async () => [] };
      },
    }),
  };
}

vi.mock("@/lib/db/client", () => ({ getDb: async () => fakeDb() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/email", () => ({
  sendMemberWelcomeEmail: async (id: string) => {
    h.welcome.push(id);
  },
}));
vi.mock("./payments-ledger", () => ({
  recordStandalonePayment: async (...args: unknown[]) => {
    h.ledger.push(args);
    return true;
  },
}));
vi.mock("./sync", () => ({
  syncMemberSubscription: async (id: string) => {
    h.subSync.push(id);
    return "active";
  },
}));
vi.mock("@/lib/payment/subscription-factory", () => ({
  getSubscriptionGateway: async () => ({
    slug: h.slug,
    gateway: {
      getPixAutomaticAuthorization: async (id: string) => {
        h.getCalls++;
        return h.authById[id] ?? h.auth;
      },
      cancelPixAutomaticAuthorization: async (id: string) => {
        if (h.cancelThrows) throw new Error("falha simulada");
        h.cancelledAuths.push(id);
      },
      cancelSubscription: async (id: string) => {
        h.cancelledSubs.push(id);
        return true;
      },
      findPixAutomaticFirstPayment: async () => h.firstPayment,
    },
  }),
}));

import {
  cancelPixAutomaticAuthorization,
  pixAutomaticContractId,
  pixAutomaticStartDate,
  syncMemberPixAutomatic,
} from "./pix-automatic";

const MEMBER = {
  id: "11111111-2222-4333-8444-555555555555",
  status: "pending",
  planId: "plan-1",
  subscriptionId: null,
  gatewaySlug: "asaas",
  gatewayCustomerId: "cus_1",
  nextBillingDate: null,
};

beforeEach(() => {
  h.member = { ...MEMBER };
  h.updates = [];
  h.auth = { id: "auth_1", status: "CREATED", subscriptionId: null, customerId: "cus_1", startDate: "2026-12-06" };
  h.authById = {};
  h.cancelThrows = false;
  h.slug = "asaas";
  h.getCalls = 0;
  h.cancelledSubs = [];
  h.cancelledAuths = [];
  h.firstPayment = { gatewayPaymentId: "pay_qr", valueCents: 2990, status: "RECEIVED" };
  h.ledger = [];
  h.welcome = [];
  h.subSync = [];
});

describe("syncMemberPixAutomatic", () => {
  it("id inválido: não consulta o gateway", async () => {
    expect(await syncMemberPixAutomatic("../auth")).toBe("not_found");
    expect(h.getCalls).toBe(0);
  });

  it("sem sócio com a autorização: not_found, sem gateway", async () => {
    h.member = null;
    expect(await syncMemberPixAutomatic("auth_1")).toBe("not_found");
    expect(h.getCalls).toBe(0);
  });

  it("autorização de outro gateway (troca de conta): não consulta", async () => {
    h.member = { ...MEMBER, gatewaySlug: "mercadopago" };
    expect(await syncMemberPixAutomatic("auth_1")).toBe("unsupported");
    expect(h.getCalls).toBe(0);
  });

  it("CREATED (QR não pago): segue pendente, nada é gravado", async () => {
    expect(await syncMemberPixAutomatic("auth_1")).toBe("pending");
    expect(h.updates).toEqual([]);
    expect(h.welcome).toEqual([]);
  });

  it("ACTIVE na 1ª vez: ativa, grava a assinatura e o vencimento, 1ª mensalidade no ledger, boas-vindas", async () => {
    h.auth = { ...h.auth, status: "ACTIVE", subscriptionId: "sub_9" };
    expect(await syncMemberPixAutomatic("auth_1")).toBe("active");
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0]).toMatchObject({ status: "active", hasPaid: true, subscriptionId: "sub_9" });
    expect((h.updates[0].nextBillingDate as Date).toISOString().slice(0, 10)).toBe("2026-12-06");
    expect(h.ledger).toHaveLength(1);
    expect(h.welcome).toEqual([MEMBER.id]);
  });

  it("ACTIVE sem assinatura ainda: ativa sem gravar subscriptionId (o cron vincula depois)", async () => {
    h.auth = { ...h.auth, status: "ACTIVE", subscriptionId: null };
    expect(await syncMemberPixAutomatic("auth_1")).toBe("active");
    expect(h.updates[0]).not.toHaveProperty("subscriptionId");
  });

  it("ACTIVE de sócio já ativo (reentrega): sem boas-vindas de novo; segue o fluxo da assinatura", async () => {
    h.member = { ...MEMBER, status: "active", subscriptionId: "sub_9" };
    h.auth = { ...h.auth, status: "ACTIVE", subscriptionId: "sub_9" };
    expect(await syncMemberPixAutomatic("auth_1")).toBe("active");
    expect(h.welcome).toEqual([]);
    expect(h.ledger).toEqual([]);
    expect(h.subSync).toEqual(["sub_9"]);
    expect(h.updates[0]).not.toHaveProperty("status");
  });

  it("ACTIVE de sócio cancelado: não reativa", async () => {
    h.member = { ...MEMBER, status: "cancelled" };
    h.auth = { ...h.auth, status: "ACTIVE" };
    expect(await syncMemberPixAutomatic("auth_1")).toBe("cancelled");
    expect(h.updates).toEqual([]);
  });

  it("CANCELLED no banco com sócio ativo: encerra a assinatura e cancela mantendo o período pago", async () => {
    const paidUntil = new Date("2026-12-06T12:00:00-03:00");
    h.member = { ...MEMBER, status: "active", subscriptionId: "sub_9", nextBillingDate: paidUntil };
    h.auth = { ...h.auth, status: "CANCELLED", subscriptionId: "sub_9" };
    expect(await syncMemberPixAutomatic("auth_1")).toBe("cancelled");
    expect(h.cancelledSubs).toEqual(["sub_9"]);
    expect(h.updates[0]).toMatchObject({ status: "cancelled", nextBillingDate: paidUntil });
  });

  it("EXPIRED com sócio pendente (QR expirou): segue pendente", async () => {
    h.auth = { ...h.auth, status: "EXPIRED" };
    expect(await syncMemberPixAutomatic("auth_1")).toBe("pending");
    expect(h.updates).toEqual([]);
  });

  it("REFUSED com a 1ª mensalidade paga: benefício só do mês pago (cancelado até o início)", async () => {
    h.auth = { ...h.auth, status: "REFUSED" };
    expect(await syncMemberPixAutomatic("auth_1")).toBe("cancelled");
    expect(h.ledger).toHaveLength(1);
    expect(h.updates[0]).toMatchObject({ status: "cancelled", hasPaid: true });
    expect((h.updates[0].nextBillingDate as Date).toISOString().slice(0, 10)).toBe("2026-12-06");
    expect(h.welcome).toEqual([]);
  });

  it("REFUSED sem pagamento: segue pendente", async () => {
    h.auth = { ...h.auth, status: "REFUSED" };
    h.firstPayment = null;
    expect(await syncMemberPixAutomatic("auth_1")).toBe("pending");
    expect(h.updates).toEqual([]);
  });
});

describe("cancelPixAutomaticAuthorization", () => {
  it("cancela só autorização CREATED ou ACTIVE", async () => {
    const { getSubscriptionGateway } = await import("@/lib/payment/subscription-factory");
    const gw = (await getSubscriptionGateway())!.gateway;
    for (const status of ["CREATED", "ACTIVE"]) {
      h.auth = { ...h.auth, status };
      await cancelPixAutomaticAuthorization(gw, "auth_1");
    }
    for (const status of ["CANCELLED", "REFUSED", "EXPIRED"]) {
      h.auth = { ...h.auth, status };
      await cancelPixAutomaticAuthorization(gw, "auth_1");
    }
    expect(h.cancelledAuths).toEqual(["auth_1", "auth_1"]);
  });

  it("id inválido: não chama o gateway", async () => {
    const { getSubscriptionGateway } = await import("@/lib/payment/subscription-factory");
    await cancelPixAutomaticAuthorization((await getSubscriptionGateway())!.gateway, "a/b");
    expect(h.getCalls).toBe(0);
  });
});

describe("contrato e início", () => {
  it("contractId tem no máximo 35 caracteres e muda a cada tentativa", () => {
    const a = pixAutomaticContractId(MEMBER.id, new Date("2026-11-06T10:00:00Z"));
    const b = pixAutomaticContractId(MEMBER.id, new Date("2026-11-06T10:05:00Z"));
    expect(a.length).toBeLessThanOrEqual(35);
    expect(a.startsWith("SOCIO-111111112222")).toBe(true);
    expect(a).not.toBe(b);
  });

  it("cobranças recorrentes começam um mês depois (a 1ª é a do QR)", () => {
    expect(pixAutomaticStartDate("2026-11-06")).toBe("2026-12-06");
    expect(pixAutomaticStartDate("2026-01-31")).toBe("2026-02-28");
  });
});

describe("troca de plano no Pix Automático (nova autorização em andamento)", () => {
  const PAID_UNTIL = new Date("2026-11-20T12:00:00-03:00");
  const changing = () => ({
    ...MEMBER,
    status: "active",
    planId: "plan-1",
    subscriptionId: "sub_old",
    nextBillingDate: PAID_UNTIL,
    currentAuthorizationId: "auth_old",
    pendingAuthorizationId: "auth_new",
    pendingPlanId: "plan-2",
  });

  beforeEach(() => {
    h.member = changing();
    h.authById = {
      auth_old: { id: "auth_old", status: "ACTIVE", subscriptionId: "sub_old", customerId: "cus_old", startDate: "2026-10-20" },
    };
  });

  it("nova ACTIVE: cancela autorização e assinatura antigas e troca plano, autorização, assinatura e vencimento", async () => {
    h.authById.auth_new = { id: "auth_new", status: "ACTIVE", subscriptionId: "sub_new", customerId: "cus_new", startDate: "2026-12-20" };
    expect(await syncMemberPixAutomatic("auth_new")).toBe("active");
    expect(h.cancelledAuths).toEqual(["auth_old"]);
    expect(h.cancelledSubs).toEqual(["sub_old"]);
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0]).toMatchObject({
      status: "active",
      planId: "plan-2",
      pixAutomaticAuthorizationId: "auth_new",
      subscriptionId: "sub_new",
      gatewayCustomerId: "cus_new",
      pixAutomaticPendingAuthorizationId: null,
      pixAutomaticPendingPlanId: null,
    });
    expect((h.updates[0].nextBillingDate as Date).toISOString().slice(0, 10)).toBe("2026-12-20");
    // O QR pago entra no ledger já no plano novo; sem boas-vindas (não é adesão).
    expect((h.ledger[0] as unknown[])[0]).toMatchObject({ planId: "plan-2" });
    expect(h.welcome).toEqual([]);
  });

  it("falha ao cancelar o débito antigo: NÃO troca (nunca dois débitos), tenta de novo depois", async () => {
    h.authById.auth_new = { id: "auth_new", status: "ACTIVE", subscriptionId: "sub_new", customerId: "cus_new", startDate: "2026-12-20" };
    h.cancelThrows = true;
    expect(await syncMemberPixAutomatic("auth_new")).toBe("active");
    expect(h.updates).toEqual([]);
  });

  it("nova aguardando (CREATED): nada muda", async () => {
    h.authById.auth_new = { id: "auth_new", status: "CREATED", customerId: "cus_new" };
    await syncMemberPixAutomatic("auth_new");
    expect(h.updates).toEqual([]);
    expect(h.cancelledAuths).toEqual([]);
  });

  it("nova recusada/expirada: desiste da troca, plano e débito atuais seguem", async () => {
    for (const status of ["REFUSED", "EXPIRED", "CANCELLED"]) {
      h.updates = [];
      h.authById.auth_new = { id: "auth_new", status, customerId: "cus_new" };
      h.firstPayment = null;
      await syncMemberPixAutomatic("auth_new");
      expect(h.updates).toEqual([{ pixAutomaticPendingAuthorizationId: null, pixAutomaticPendingPlanId: null }]);
    }
    expect(h.cancelledAuths).toEqual([]);
    expect(h.cancelledSubs).toEqual([]);
  });

  it("aviso de 'antiga cancelada' durante a troca com a nova ativa: conclui a troca, não cancela o sócio", async () => {
    h.authById.auth_old = { ...h.authById.auth_old, status: "CANCELLED" };
    h.authById.auth_new = { id: "auth_new", status: "ACTIVE", subscriptionId: "sub_new", customerId: "cus_new", startDate: "2026-12-20" };
    expect(await syncMemberPixAutomatic("auth_old")).toBe("active");
    expect(h.updates[0]).toMatchObject({ status: "active", planId: "plan-2" });
    expect(h.updates.some((u) => u.status === "cancelled")).toBe(false);
  });

  it("antiga cancelada pelo pagador com a nova ainda aguardando: não cancela agora", async () => {
    h.authById.auth_old = { ...h.authById.auth_old, status: "CANCELLED" };
    h.authById.auth_new = { id: "auth_new", status: "CREATED" };
    await syncMemberPixAutomatic("auth_old");
    expect(h.updates).toEqual([]);
  });

  it("nova ativa com sócio cancelado no meio do caminho: encerra a nova e limpa a troca", async () => {
    h.member = { ...changing(), status: "cancelled" };
    h.authById.auth_new = { id: "auth_new", status: "ACTIVE", customerId: "cus_new" };
    await syncMemberPixAutomatic("auth_new");
    expect(h.cancelledAuths).toEqual(["auth_new"]);
    expect(h.updates).toEqual([{ pixAutomaticPendingAuthorizationId: null, pixAutomaticPendingPlanId: null }]);
  });
});
