import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Regressão (auditoria run-2, Alta): o objeto `cardData` do cliente era espalhado depois do valor do
 * servidor em createPayment, então `cardData.amountCents` mudava o valor cobrado no gateway
 * (R$ 5 por um pedido de R$ 100). Agora só os campos de cartão validados entram, antes dos campos
 * do servidor, e qualquer campo a mais é recusado sem chamar o gateway.
 * Também: ingresso só para jogo à venda (em casa, ativo, vendas abertas) — Moderado.
 */

const GAME_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const ORDER_ID = "11111111-2222-3333-4444-555555555555";

const h = vi.hoisted(() => ({
  inserts: [] as { table: unknown; values: unknown }[],
  fetchBodies: [] as { url: string; body: unknown }[],
  applied: [] as unknown[],
  gameWheres: [] as unknown[],
  gameOnSale: true,
}));

vi.mock("@/lib/db/client", async () => {
  const schema = await import("@/lib/db/schema");
  function chain(kind: string, table?: unknown) {
    const st: { kind: string; table?: unknown; values?: Record<string, unknown>; where?: unknown } = { kind, table };
    const resolve = () => {
      if (st.kind === "select") {
        if (st.table === schema.games) {
          h.gameWheres.push(st.where);
          return h.gameOnSale ? [{ id: GAME_ID, isHome: true, active: true }] : [];
        }
        return [];
      }
      if (st.kind === "insert") {
        h.inserts.push({ table: st.table, values: st.values });
        if (st.table === schema.orders) return [{ id: ORDER_ID }];
        if (st.table === schema.payments) return [{ id: "pay-1", ...st.values }];
        return [];
      }
      return [];
    };
    const p: Record<string, unknown> = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(resolve()).then(res, rej);
          return (...args: unknown[]) => {
            if (prop === "from") st.table = args[0];
            if (prop === "values") st.values = args[0] as Record<string, unknown>;
            if (prop === "where") st.where = args[0];
            return p;
          };
        },
      }
    );
    return p;
  }
  const db = {
    select: () => chain("select"),
    insert: (t: unknown) => chain("insert", t),
    update: (t: unknown) => chain("update", t),
    delete: (t: unknown) => chain("delete", t),
  };
  return { getDb: async () => db };
});

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));
vi.mock("@/lib/payment/card-ratelimit", () => ({
  CARD_RATE_LIMIT_ERROR: "LIMITE_CARTAO",
  checkCardAttemptLimit: async () => true,
}));
vi.mock("@/lib/config", () => ({ getSiteConfig: async () => ({ siteName: "Clube Teste" }) }));
vi.mock("@/lib/tickets/resolve", () => ({
  getTicketTypesForGames: async () => ({
    [GAME_ID]: [{ id: null, code: "inteira", name: "Inteira", priceCents: 10000, maxQuantity: null, comboTiers: [] }],
  }),
}));
vi.mock("@/lib/membership/discount", () => ({ getSessionMemberDiscount: async () => null }));
vi.mock("@/app/actions/promotions", () => ({ getActivePromotion: async () => null }));
vi.mock("@/lib/customers/upsert", () => ({ upsertCustomer: async () => "cust-1" }));
vi.mock("@/lib/customers/identity", () => ({ withStoredIdentity: async (b: unknown) => b }));
vi.mock("@/lib/customers/cpf", () => ({ resolveCustomerCpf: async () => undefined }));
vi.mock("@/lib/payment/sync", () => ({
  applyGatewayStatus: async (...a: unknown[]) => { h.applied.push(a); return true; },
}));
// Real Asaas client; only the gateway lookup is mocked.
vi.mock("@/lib/payment", async () => {
  const { AsaasGateway } = await import("@/lib/payment/asaas");
  return {
    getGatewayForMethod: async () => ({ gateway: new AsaasGateway({ apiKey: "dummy-key", sandbox: true }), slug: "asaas" }),
    getActiveGatewayMeta: async () => ({}),
    getPaymentGatewayBySlug: async () => { throw new Error("unused"); },
  };
});

import * as schema from "@/lib/db/schema";
import { createOrder } from "@/app/actions/checkout";

beforeEach(() => {
  h.inserts = [];
  h.fetchBodies = [];
  h.applied = [];
  h.gameWheres = [];
  h.gameOnSale = true;
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    h.fetchBodies.push({ url, body });
    let json: unknown = {};
    if (url.endsWith("/customers")) json = { id: "cus_dummy" };
    else if (url.endsWith("/payments")) json = { id: "pay_dummy", status: "PENDING" };
    else if (url.endsWith("/pixQrCode")) json = { payload: "000201dummy", encodedImage: "AAAA" };
    return new Response(JSON.stringify(json), { status: 200, headers: { "content-type": "application/json" } });
  });
});

const buyer = { name: "Torcedor Teste", email: "fan@example.com", whatsapp: "11999990000" };

function sent() {
  const pay = h.fetchBodies.find((f) => f.url.endsWith("/payments"));
  const payInsert = h.inserts.find((i) => i.table === schema.payments)?.values as { amountCents?: number } | undefined;
  return { pay: pay?.body as { value?: number; billingType?: string } | undefined, payInsert };
}

describe("createOrder: valor cobrado é sempre o do servidor", () => {
  it("sem cartão (Pix): o gateway recebe o total do servidor", async () => {
    const r = await createOrder({ buyer, tickets: [{ gameId: GAME_ID, typeCode: "inteira", quantity: 1 }], paymentMethod: "pix" });
    expect(r.success).toBe(true);
    expect(sent().pay?.value).toBe(100);
    expect(sent().payInsert?.amountCents).toBe(10000);
  });

  it("cardData com amountCents (campo extra) é recusado e o gateway não é chamado", async () => {
    const r = await createOrder({
      buyer,
      tickets: [{ gameId: GAME_ID, typeCode: "inteira", quantity: 1 }],
      paymentMethod: "pix",
      cardData: { amountCents: 500 } as never,
    });
    expect(r.success).toBe(false);
    expect(h.fetchBodies).toEqual([]);
    expect(h.inserts).toEqual([]);
  });

  it("cardData válido com campos extras (method/orderId/amountCents) também é recusado", async () => {
    const r = await createOrder({
      buyer,
      tickets: [{ gameId: GAME_ID, typeCode: "inteira", quantity: 1 }],
      paymentMethod: "pix",
      cardData: { cardToken: "tok", installments: 1, paymentMethodId: "visa", identificationNumber: "", method: "credit_card", amountCents: 1, orderId: "x" } as never,
    });
    expect(r.success).toBe(false);
    expect(h.fetchBodies).toEqual([]);
  });

  it("forma de pagamento fora de pix/cartão é recusada", async () => {
    const r = await createOrder({ buyer, tickets: [{ gameId: GAME_ID, typeCode: "inteira", quantity: 1 }], paymentMethod: "boleto" as never });
    expect(r.success).toBe(false);
    expect(h.fetchBodies).toEqual([]);
  });
});

describe("nenhuma ação de pedido espalha o cardData cru no pagamento", () => {
  it("checkout.ts e cantina.ts não usam `...input.cardData`", () => {
    for (const f of ["checkout.ts", "cantina.ts"]) {
      const src = readFileSync(path.join(__dirname, f), "utf8");
      expect(src, f).not.toMatch(/\.\.\.\s*input\.cardData/);
    }
  });
});

describe("createOrder: só vende ingresso de jogo à venda", () => {
  it("o filtro de jogos exige jogo em casa, ativo e com vendas abertas", async () => {
    const { PgDialect } = await import("drizzle-orm/pg-core");
    await createOrder({ buyer, tickets: [{ gameId: GAME_ID, typeCode: "inteira", quantity: 1 }], paymentMethod: "pix" });
    const sqlText = new PgDialect().sqlToQuery(h.gameWheres[0] as never).sql;
    expect(sqlText).toContain('"games"."is_home"');
    expect(sqlText).toContain('"games"."active"');
    expect(sqlText).toContain("ticket_sales_ends_at");
  });

  it("jogo encerrado, oculto ou fora de casa (fora do filtro) → recusa sem criar pedido nem cobrar", async () => {
    h.gameOnSale = false;
    const r = await createOrder({ buyer, tickets: [{ gameId: GAME_ID, typeCode: "inteira", quantity: 1 }], paymentMethod: "pix" });
    expect(r.success).toBe(false);
    expect(h.inserts).toEqual([]);
    expect(h.fetchBodies).toEqual([]);
  });
});
