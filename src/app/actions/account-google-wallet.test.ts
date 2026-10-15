import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { generateKeyPair, exportPKCS8, jwtVerify } from "jose";

/**
 * Google Carteira na área logada: o link só sai para o sócio do e-mail da sessão, com
 * assinatura em dia, com limite por conta, e a chave/JWT nunca vão para o log.
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const TOKEN = "9a9f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e99";
const ISSUER = "3388000000012345678";
const SA = "wallet-socios@clube-teste.iam.gserviceaccount.com";
const SAVE_PREFIX = "https://pay.google.com/gp/v/save/";
const ME = {
  id: "a-1",
  email: "titular@example.com",
  name: "Titular",
  whatsapp: "67999998888",
  emailVerifiedAt: new Date(),
  passwordChangedAt: new Date(1000),
};

const h = vi.hoisted(() => ({
  results: [] as unknown[],
  session: null as unknown,
  limited: false,
  tenant: "clube-a" as string | null,
  view: null as unknown,
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
    return { select: () => chain, update: () => chain };
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
  getCurrentTenantSlug: async () => h.tenant,
  getAppBaseUrl: async () => "https://clube.example",
}));
vi.mock("@/lib/membership/card", () => ({
  getMemberCardView: async () => h.view,
}));
vi.mock("@/lib/membership/sync", () => ({
  syncMemberById: async () => {},
  getMemberOpenInvoiceUrl: async () => null,
}));
vi.mock("@/lib/config", () => ({
  getSiteConfig: async () => ({ siteName: "Clube A", primaryColor: "#1e3a8a", clubLogoUrl: "/logo.png" }),
}));
vi.mock("@/app/actions/membership", () => ({
  getPublicMembershipPlans: async () => [],
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { getMyGoogleWalletUrl, getMyMembership } from "./account";

const member = (over: Record<string, unknown> = {}) => ({
  id: MEMBER_ID,
  name: "Ana Torcedora",
  status: "active",
  planId: null,
  hasPaid: true,
  pendingPlanId: null,
  memberCardToken: TOKEN,
  nextBillingDate: new Date("2026-11-10T15:00:00Z"),
  subscriptionId: null,
  gatewaySlug: null,
  wallName: null,
  ...over,
});

const view = (over: Record<string, unknown> = {}) => ({
  memberId: MEMBER_ID,
  name: "Ana Torcedora",
  planName: "Carcará",
  status: "active",
  memberSince: new Date("2026-03-01T15:00:00Z"),
  nextBillingDate: new Date("2026-11-10T15:00:00Z"),
  cancelledAt: null,
  ticketDiscountPct: 0,
  productDiscountPct: 10,
  freeTicketsPerHomeGame: 0,
  cardColor: "#1e3a8a",
  benefits: [],
  ...over,
});

let privateKeyPem = "";
let publicKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { modulusLength: 2048, extractable: true });
  privateKeyPem = await exportPKCS8(pair.privateKey);
  publicKey = pair.publicKey;
});

function setGoogleEnv(pem: string = privateKeyPem) {
  process.env.GOOGLE_WALLET_ISSUER_ID = ISSUER;
  process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL = SA;
  process.env.GOOGLE_WALLET_PRIVATE_KEY = pem.replace(/\n/g, "\\n");
}

beforeEach(() => {
  setGoogleEnv();
  Object.assign(h, { results: [], session: ME, limited: false, tenant: "clube-a", view: view() });
});

afterEach(() => {
  delete process.env.GOOGLE_WALLET_ISSUER_ID;
  delete process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_WALLET_PRIVATE_KEY;
  vi.restoreAllMocks();
});

describe("getMyGoogleWalletUrl", () => {
  it("sem sessão → erro, nada é montado", async () => {
    h.session = null;
    const r = await getMyGoogleWalletUrl();
    expect(r).toEqual({ ok: false, error: "Sua sessão expirou. Entre novamente." });
  });

  it("recurso desligado (sem variáveis) → indisponível", async () => {
    delete process.env.GOOGLE_WALLET_ISSUER_ID;
    delete process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_WALLET_PRIVATE_KEY;
    h.results = [[member()]];
    const r = await getMyGoogleWalletUrl();
    expect(r.ok).toBe(false);
    expect(r).toHaveProperty("error", "Salvar no Google Carteira não está disponível no momento.");
  });

  it("limite de tentativas por conta → recusa", async () => {
    h.limited = true;
    h.results = [[member()]];
    const r = await getMyGoogleWalletUrl();
    expect(r).toEqual({ ok: false, error: "Muitas tentativas. Aguarde alguns minutos." });
  });

  it("sem carteirinha (nenhum sócio com este e-mail) → erro", async () => {
    h.results = [[]];
    const r = await getMyGoogleWalletUrl();
    expect(r).toEqual({ ok: false, error: "Você ainda não tem carteirinha." });
  });

  it("sócio sem benefício (suspenso) → 'Disponível com a assinatura em dia', sem link", async () => {
    h.results = [[member({ status: "suspended" })]];
    h.view = view({ status: "suspended" });
    const r = await getMyGoogleWalletUrl();
    expect(r).toEqual({ ok: false, error: "Disponível com a assinatura em dia." });
  });

  it("sem clube no contexto (tenant ausente) → erro genérico", async () => {
    h.tenant = null;
    h.results = [[member()]];
    const r = await getMyGoogleWalletUrl();
    expect(r).toEqual({ ok: false, error: "Não foi possível gerar o link agora. Tente mais tarde." });
  });

  it("sócio em dia → link assinado do próprio sócio, sem o e-mail da conta", async () => {
    h.results = [[member()]];
    const r = await getMyGoogleWalletUrl();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.url.startsWith(SAVE_PREFIX)).toBe(true);
    expect(r.url).not.toContain(ME.email);
    const { payload } = await jwtVerify(r.url.slice(SAVE_PREFIX.length), publicKey, {
      issuer: SA,
      audience: "google",
      algorithms: ["RS256"],
    });
    expect(payload.typ).toBe("savetowallet");
    const inner = payload.payload as { genericObjects: { id: string; header: { defaultValue: { value: string } } }[] };
    expect(inner.genericObjects[0].id).toMatch(new RegExp(`^${ISSUER}\\.socio_clube-a_${MEMBER_ID}_[0-9a-f]{12}$`));
    expect(inner.genericObjects[0].header.defaultValue.value).toBe("Ana Torcedora");
  });

  it("chave inválida → mensagem genérica; log sem a chave nem o erro bruto", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    setGoogleEnv("-----BEGIN PRIVATE KEY-----\nMIIB-CHAVE-FALSA-SEGREDO\n-----END PRIVATE KEY-----\n");
    h.results = [[member()]];
    const r = await getMyGoogleWalletUrl();
    expect(r).toEqual({ ok: false, error: "Não foi possível gerar o link agora. Tente mais tarde." });
    const logged = JSON.stringify(errors.mock.calls);
    expect(logged).not.toContain("CHAVE-FALSA");
    expect(logged).not.toContain("BEGIN PRIVATE KEY");
  });
});

describe("getMyMembership informa googleWalletAvailable (só configuração)", () => {
  it("com as variáveis → true; sem → false", async () => {
    h.results = [[member()]];
    const on = await getMyMembership();
    expect(on).toMatchObject({ ok: true, googleWalletAvailable: true });

    delete process.env.GOOGLE_WALLET_PRIVATE_KEY;
    h.results = [[member()]];
    const off = await getMyMembership();
    expect(off).toMatchObject({ ok: true, googleWalletAvailable: false });
  });
});
