import { describe, it, expect, beforeEach, vi } from "vitest";
import { SignJWT } from "jose";

/**
 * Meus Pedidos: quem DIGITA um WhatsApp só consulta pedidos — sem QR/id/serial
 * do ingresso nem código de retirada (todos valem na portaria/balcão). Credenciais
 * só pelo link enviado ao comprador. O link pós-compra exige a chave de
 * idempotência do navegador do comprador (o id do pedido não basta).
 */
const SECRET = "segredo-de-teste-com-tamanho-suficiente";
const ORDER = {
  id: "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f",
  status: "paid",
  idempotencyKey: "idem-do-comprador",
  pickupCode: null,
  items: [],
};
const TICKET = {
  id: "1b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f",
  serialNo: 1234,
  gameId: "g1",
  typeCode: "inteira",
  typeName: "Inteira",
  status: "valid",
};

const h = vi.hoisted(() => ({ orderRow: null as unknown, cookie: null as string | null }));

vi.mock("@/lib/db/queries", () => ({ getOrdersByWhatsapp: async () => [ORDER] }));
vi.mock("@/lib/config", () => ({
  getSiteConfig: async () => ({ siteName: "Clube", clubLogoUrl: "" }),
  DEFAULT_CLUB_LOGO_URL: "",
}));
vi.mock("@/lib/tickets/generate", () => ({ ensureTicketsForOrder: async () => [TICKET] }));
vi.mock("@/lib/pickup/code", () => ({ ensurePickupCode: async () => "RET-123" }));
vi.mock("@/lib/raffle/queries", () => ({ getSoldNumbersForOrders: async () => new Map() }));
vi.mock("@/lib/base-url", () => ({
  getCurrentTenantSlug: async () => "clube-a",
  getAppBaseUrl: async () => "https://clube.example",
}));
vi.mock("@/lib/ratelimit", () => ({
  getClientIp: async () => "203.0.113.10",
  rateLimit: async () => ({ ok: true, remaining: 1 }),
}));
vi.mock("@/lib/orders/turnstile", () => ({ isTurnstileConfigured: () => false, verifyTurnstileToken: async () => true }));
vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where"]) chain[m] = () => chain;
  chain.limit = async () => (h.orderRow ? [h.orderRow] : []);
  return { getDb: async () => chain };
});
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => (h.cookie ? { value: h.cookie } : undefined),
    set: (_n: string, v: string) => {
      h.cookie = v;
    },
    delete: () => {},
  }),
}));

import { verifyOrdersCaptcha, startOrdersSession, getOrdersSession, getOrdersTokenForOrder } from "./checkout";
import { signPhoneToken } from "@/lib/orders/phone-token";

beforeEach(() => {
  process.env.TICKET_SIGNING_SECRET = SECRET;
  h.orderRow = null;
  h.cookie = null;
});

function assertNoCredentials(order: Record<string, unknown>) {
  const json = JSON.stringify(order);
  expect(json).not.toContain(TICKET.id);
  expect(json).not.toContain("1234");
  expect(json).not.toContain("RET-123");
  expect(json).not.toContain("idem-do-comprador");
  expect(order.credentialsHidden).toBe(true);
  expect((order.tickets as { qrToken?: string }[])[0].qrToken).toBeUndefined();
}

describe("Meus Pedidos — número digitado", () => {
  it("consulta sem credenciais e a sessão continua sem credenciais", async () => {
    const r = await verifyOrdersCaptcha("11900000000", "");
    expect(r.ok).toBe(true);
    assertNoCredentials((r as { orders: Record<string, unknown>[] }).orders[0]);
    // volta à página: cookie "typed" → segue sem credenciais
    const s = await getOrdersSession();
    assertNoCredentials(s.orders[0] as unknown as Record<string, unknown>);
    expect((s.orders[0] as unknown as { pickupHidden: boolean }).pickupHidden).toBe(true);
  });
});

describe("Meus Pedidos — link enviado ao comprador", () => {
  it("mostra QR assinado e código de retirada; nunca a chave de idempotência", async () => {
    const t = await signPhoneToken("11900000000", "clube-a");
    const s = await startOrdersSession(t!);
    const o = s.orders[0] as unknown as Record<string, unknown>;
    expect(o.credentialsHidden).toBe(false);
    expect((o.tickets as { qrToken?: string }[])[0].qrToken).toMatch(/^ey/);
    expect(o.pickupCode).toBe("RET-123");
    expect(JSON.stringify(o)).not.toContain("idem-do-comprador");
  });

  it("token legado (sem origem) é tratado como digitado — sem credenciais", async () => {
    const legacy = await new SignJWT({ tel: "11900000000", v: 1, tn: "clube-a" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(new TextEncoder().encode(SECRET));
    const s = await startOrdersSession(legacy);
    assertNoCredentials(s.orders[0] as unknown as Record<string, unknown>);
  });
});

describe("getOrdersTokenForOrder (link pós-compra)", () => {
  beforeEach(() => {
    h.orderRow = { status: "paid", whatsapp: "11900000000", idem: "idem-do-comprador" };
  });

  it("com a chave do comprador → devolve link", async () => {
    expect(await getOrdersTokenForOrder(ORDER.id, "idem-do-comprador")).toMatch(/^ey/);
  });

  it("só com o id do pedido (ou chave errada) → nada", async () => {
    expect(await getOrdersTokenForOrder(ORDER.id)).toBeNull();
    expect(await getOrdersTokenForOrder(ORDER.id, "chute")).toBeNull();
  });

  it("pedido sem chave registrada → nada", async () => {
    h.orderRow = { status: "paid", whatsapp: "11900000000", idem: null };
    expect(await getOrdersTokenForOrder(ORDER.id, "qualquer")).toBeNull();
  });
});
