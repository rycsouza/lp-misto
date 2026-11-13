import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regressão (auditoria run-2): estoque da cantina (`stock_sold`).
 * - Item esgotado no meio da lista devolvia nada do que já tinha sido debitado.
 * - Pedido expirado/falho/estornado não devolvia o `stock_sold` (restoreOrderStock só via produto/ingresso).
 * - Cantina desligada (flag) ainda aceitava compra pelo endpoint da ação.
 */

const ITEM_A = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const ITEM_B = "1b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const ORDER_ID = "11111111-2222-3333-4444-555555555555";

const h = vi.hoisted(() => ({
  enabled: true,
  soldOutItem: null as string | null,
  insertOrderThrows: false,
  released: [] as { itemId: string; quantity: number }[],
  stockUpdates: [] as unknown[],
  inserts: [] as unknown[],
  gatewayCalls: 0,
}));

vi.mock("@/lib/cantina/flag", () => ({
  get CANTINA_ENABLED() {
    return h.enabled;
  },
}));
vi.mock("@/lib/cantina/stock", () => ({
  releaseCantinaStock: async (itemId: string, quantity: number) => {
    h.released.push({ itemId, quantity });
  },
}));

vi.mock("@/lib/db/client", async () => {
  const schema = await import("@/lib/db/schema");
  function chain(kind: string, table?: unknown) {
    const st: { kind: string; table?: unknown; where?: unknown; set?: unknown } = { kind, table };
    const resolve = () => {
      if (st.kind === "select" && st.table === schema.cantinaItems) {
        return [
          { id: ITEM_A, name: "Pastel", needsPrep: false, priceCents: 1000, active: true },
          { id: ITEM_B, name: "Refri", needsPrep: false, priceCents: 500, active: true },
        ];
      }
      if (st.kind === "update" && st.table === schema.cantinaItems) {
        h.stockUpdates.push(st.where);
        // O 2º item da lista "esgota" quando pedido.
        return h.soldOutItem && h.stockUpdates.length === 2 ? [] : [{ id: "ok" }];
      }
      if (st.kind === "insert") {
        h.inserts.push(st.table);
        if (st.table === schema.orders) {
          if (h.insertOrderThrows) throw new Error("db down");
          return [{ id: ORDER_ID }];
        }
        if (st.table === schema.payments) return [{ id: "pay-1" }];
        return [];
      }
      return [];
    };
    const p: Record<string, unknown> = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then")
            return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
              try {
                return Promise.resolve(resolve()).then(res, rej);
              } catch (e) {
                return Promise.reject(e).then(res, rej);
              }
            };
          return (...args: unknown[]) => {
            if (prop === "from") st.table = args[0];
            if (prop === "where") st.where = args[0];
            if (prop === "set") st.set = args[0];
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

vi.mock("@/lib/payment/card-ratelimit", () => ({ CARD_RATE_LIMIT_ERROR: "LIMITE", checkCardAttemptLimit: async () => true }));
vi.mock("@/lib/customers/identity", () => ({ withStoredIdentity: async (b: unknown) => b }));
vi.mock("@/lib/customers/upsert", () => ({ upsertCustomer: async () => "cust-1" }));
vi.mock("@/lib/cantina/config", () => ({
  getCantinaConfig: async () => ({ minOrderCents: 0 }),
  computeCantinaServiceFeeCents: () => 0,
}));
vi.mock("@/lib/config", () => ({ getSiteConfig: async () => ({ siteName: "Clube" }) }));
vi.mock("@/lib/payment/sync", () => ({ applyGatewayStatus: async () => true }));
vi.mock("@/lib/payment", () => ({
  getGatewayForMethod: async () => ({
    slug: "asaas",
    gateway: {
      createPayment: async () => {
        h.gatewayCalls++;
        return { gatewayPaymentId: "pay_x", pixQrCode: "000201" };
      },
    },
  }),
}));
vi.mock("@/lib/admin/auth-guard", () => ({ requireModule: async () => { throw new Error("não usado"); } }));
vi.mock("@/lib/accounts/my-customer", () => ({ getMyCustomerWhere: async () => null }));

import { createCantinaOrder } from "./cantina";

const buyer = { name: "Torcedor Teste", email: "fan@example.com", whatsapp: "11999990000" };
const items = [
  { itemId: ITEM_A, quantity: 2 },
  { itemId: ITEM_B, quantity: 3 },
];

beforeEach(() => {
  h.enabled = true;
  h.soldOutItem = null;
  h.insertOrderThrows = false;
  h.released = [];
  h.stockUpdates = [];
  h.inserts = [];
  h.gatewayCalls = 0;
});

describe("createCantinaOrder — estoque", () => {
  it("compra normal: debita e não devolve nada", async () => {
    const r = await createCantinaOrder({ buyer, items, paymentMethod: "pix" } as never);
    expect(r.success).toBe(true);
    expect(h.stockUpdates).toHaveLength(2);
    expect(h.released).toEqual([]);
  });

  it("2º item esgotado: devolve o que já tinha sido debitado do 1º e não cria pedido", async () => {
    h.soldOutItem = ITEM_B;
    const r = await createCantinaOrder({ buyer, items, paymentMethod: "pix" } as never);
    expect(r.success).toBe(false);
    expect(h.released).toEqual([{ itemId: ITEM_A, quantity: 2 }]);
    expect(h.inserts).toEqual([]);
    expect(h.gatewayCalls).toBe(0);
  });

  it("erro antes de criar o pedido: devolve todo o estoque debitado", async () => {
    h.insertOrderThrows = true;
    const r = await createCantinaOrder({ buyer, items, paymentMethod: "pix" } as never);
    expect(r.success).toBe(false);
    expect(h.released).toEqual([
      { itemId: ITEM_A, quantity: 2 },
      { itemId: ITEM_B, quantity: 3 },
    ]);
  });

  it("cantina desligada: recusa sem tocar no banco nem no gateway", async () => {
    h.enabled = false;
    const r = await createCantinaOrder({ buyer, items, paymentMethod: "pix" } as never);
    expect(r.success).toBe(false);
    expect(h.stockUpdates).toEqual([]);
    expect(h.inserts).toEqual([]);
    expect(h.gatewayCalls).toBe(0);
  });
});
