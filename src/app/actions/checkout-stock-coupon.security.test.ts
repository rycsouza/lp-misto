import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Regressão (auditoria run-2): estoque de produtos e cupons limitados.
 * - Médio: uma requisição anônima com linhas repetidas zerava o estoque sem criar pedido.
 * - Moderado: pedidos não pagos consumiam o limite do cupom para sempre.
 * Usa o query builder real do drizzle (pg-proxy) sobre um interpretador em memória que aplica
 * os UPDATEs condicionais exatamente como o SQL gerado diz.
 */

type Row = Record<string, unknown>;
const st = vi.hoisted(() => ({
  products: new Map<string, Row>(),
  cantina: new Map<string, Row>(),
  coupons: [] as Row[],
  orders: [] as Row[],
  orderItems: [] as Row[],
  couponUsages: 0,
  payments: [] as Row[],
  log: [] as string[],
  seq: 0,
  gatewayCalls: 0,
}));

function retCols(sqlText: string): string[] {
  const m = /returning (.+)$/i.exec(sqlText) ?? /^select (.+?) from /i.exec(sqlText);
  if (!m) return [];
  return m[1].split(/,\s*/).map((c) => c.replace(/"[^"]+"\./, "").replace(/"/g, "").trim());
}
function toArr(cols: string[], obj: Row): unknown[] {
  return cols.map((c) => (c in obj ? obj[c] : null));
}
function newId(): string {
  st.seq++;
  return `00000000-0000-4000-8000-${String(st.seq).padStart(12, "0")}`;
}

async function handler(sqlText: string, params: unknown[], method: "all" | "execute") {
  const s = sqlText;
  st.log.push(`${method} ${s} :: ${JSON.stringify(params)}`);
  const cols = retCols(s);
  const out = (objs: Row[]) => ({ rows: method === "all" ? objs.map((o) => toArr(cols, o)) : objs });

  // products
  if (/^select .* from "products" where "products"."id" in/i.test(s)) {
    return out([...st.products.values()].filter((p) => params.includes(p.id)));
  }
  if (/^update "products" set "stock" = \(?"products"."stock" - \$1/i.test(s)) {
    const qty = params[0] as number;
    const id = params.find((x) => typeof x === "string" && st.products.has(x)) as string;
    const p = st.products.get(id);
    if (!p || !(p.stock == null || (p.stock as number) >= qty)) return out([]);
    if (p.stock != null) p.stock = (p.stock as number) - qty;
    return out([{ id }]);
  }
  if (/^update "products" set "stock" = \(?"products"."stock" \+ \$1/i.test(s)) {
    const qty = params[0] as number;
    const id = params.find((x) => typeof x === "string" && st.products.has(x)) as string;
    const p = st.products.get(id);
    if (p && p.stock != null) p.stock = (p.stock as number) + qty;
    return out([]);
  }
  // cantina
  if (/^select .* from "cantina_items"/i.test(s)) {
    const all = [...st.cantina.values()];
    const filtered = /"cantina_items"."id" in/i.test(s) ? all.filter((c) => params.includes(c.id)) : all.filter((c) => c.active);
    return out(filtered);
  }
  if (/^update "cantina_items" set "stock_sold"/i.test(s)) {
    const qty = params[0] as number;
    const id = params.find((p) => typeof p === "string" && st.cantina.has(p)) as string;
    const c = st.cantina.get(id);
    if (!c || !c.active) return out([]);
    if (c.stock_cap != null && (c.stock_sold as number) + qty > (c.stock_cap as number)) return out([]);
    c.stock_sold = (c.stock_sold as number) + qty;
    return out([{ id }]);
  }
  // customers
  if (/^insert into "customers"/i.test(s)) return out([{ id: "11111111-1111-4111-8111-111111111111" }]);
  if (/^select .* from "customers"/i.test(s)) return out([]);
  // orders
  if (/^insert into "orders"/i.test(s)) {
    const o = { id: newId(), status: "pending", stock_restored: false };
    st.orders.push(o);
    return out([o]);
  }
  if (/^update "orders" set "stock_restored"/i.test(s)) {
    const id = params.find((p) => typeof p === "string" && st.orders.some((o) => o.id === p)) as string;
    const o = st.orders.find((x) => x.id === id && x.stock_restored === false);
    if (!o) return out([]);
    o.stock_restored = true;
    return out([{ id }]);
  }
  if (/^update "orders" set "status"/i.test(s)) {
    const status = params[0] as string;
    const id = params.find((p) => typeof p === "string" && st.orders.some((o) => o.id === p)) as string;
    const o = st.orders.find((x) => x.id === id);
    if (o) o.status = status;
    return out([]);
  }
  if (/^insert into "order_items"/i.test(s)) return out([]);
  if (/^select .* from "order_items"/i.test(s)) {
    const [orderId, type] = params as [string, string];
    return out(st.orderItems.filter((i) => i.order_id === orderId && i.type === type));
  }
  if (/^insert into "cantina_vouchers"/i.test(s)) return out([]);
  // coupons
  if (/^select .* from "coupons"/i.test(s)) {
    const code = String(params[0]);
    return out(st.coupons.filter((c) => String(c.code).toUpperCase() === code));
  }
  if (/^update "ticket_types"/i.test(s)) return out([]);
  if (/^insert into "coupon_usages"/i.test(s)) {
    st.couponUsages++;
    return out([]);
  }
  if (/^update "coupons" set "usage_count" = \(?"coupons"."usage_count" \+ 1/i.test(s)) {
    const id = params.find((p) => st.coupons.some((c) => c.id === p));
    const c = st.coupons.find((x) => x.id === id);
    if (!c) return out([]);
    // Reserva condicional: usage_count < max_usages (ou sem limite).
    if (/max_usages/.test(s) && (st as { couponFullOnClaim?: boolean }).couponFullOnClaim) return out([]);
    if (/max_usages/.test(s) && c.max_usages != null && (c.usage_count as number) >= (c.max_usages as number)) return out([]);
    c.usage_count = (c.usage_count as number) + 1;
    return out([{ id: c.id }]);
  }
  if (/^update "coupons" set "usage_count" = GREATEST\(0, "coupons"."usage_count" - 1\)/i.test(s)) {
    const id = params.find((p) => st.coupons.some((c) => c.id === p));
    const c = st.coupons.find((x) => x.id === id);
    if (c) c.usage_count = Math.max(0, (c.usage_count as number) - 1);
    return out([]);
  }
  if (/^delete from "coupon_usages"/i.test(s)) {
    const n = st.couponUsages;
    st.couponUsages = 0;
    return out(n > 0 ? [{ coupon_id: st.coupons[0].id }] : []);
  }
  if (/^update "coupons"/i.test(s)) throw new Error("UNEXPECTED_COUPON_UPDATE " + s);
  // payments
  if (/^insert into "payments"/i.test(s)) {
    const p = { id: newId(), status: "pending", amount_cents: params.find((x) => typeof x === "number") ?? 0 };
    st.payments.push(p);
    return out([p]);
  }
  if (/^update "payments" set "status"/i.test(s)) {
    const id = params.find((p) => typeof p === "string" && st.payments.some((x) => x.id === p)) as string;
    const p = st.payments.find((x) => x.id === id && x.status === "pending");
    if (!p) return out([]);
    p.status = params[0];
    return out([{ id }]);
  }
  throw new Error("UNHANDLED_SQL " + s);
}

vi.mock("@/lib/db/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const db = drizzle(handler as never);
  return { getDb: async () => db };
});
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: async () => ({ ok: true }), getClientIp: async () => "203.0.113.9" }));
vi.mock("@/lib/payment/card-ratelimit", () => ({
  CARD_RATE_LIMIT_ERROR: "LIMITE",
  MEMBER_CARD_RATE_LIMIT_ERROR: "LIMITE",
  checkCardAttemptLimit: async () => true,
}));
vi.mock("@/lib/membership/discount", () => ({ getSessionMemberDiscount: async () => null }));
vi.mock("@/app/actions/promotions", () => ({ getActivePromotion: async () => null }));
vi.mock("@/lib/config", () => ({ getSiteConfig: async () => ({ siteName: "Clube Teste" }) }));
vi.mock("@/lib/customers/cpf", () => ({ resolveCustomerCpf: async () => undefined }));
vi.mock("@/lib/email", () => ({ sendOrderConfirmation: async () => {} }));
vi.mock("@/lib/raffle/assign", () => ({ releaseRaffleNumbers: async () => {}, assignRaffleNumbers: async () => {} }));
vi.mock("@/lib/cantina/config", () => ({
  getCantinaConfig: async () => ({ minOrderCents: 0 }),
  computeCantinaServiceFeeCents: () => 0,
}));
vi.mock("@/lib/payment", () => ({
  getActiveGatewayMeta: async () => ({}),
  getPaymentGatewayBySlug: async () => null,
  getGatewayForMethod: async () => ({
    slug: "dummy",
    gateway: {
      createPayment: async () => {
        st.gatewayCalls++;
        return { gatewayPaymentId: "pay_dummy_" + st.gatewayCalls, pixQrCode: "dummy-qr", pixExpiresAt: new Date(Date.now() + 3600_000) };
      },
    },
  }),
}));

import { createProductOrder } from "@/app/actions/checkout";
import { validateCoupon } from "@/app/actions/coupon";
import { applyGatewayStatus } from "@/lib/payment/sync";
import { restoreOrderStock } from "@/lib/stock/restore";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const attacker = { name: "Anon Teste", email: "anon@example.test", whatsapp: "11900000001" };
const victim = { name: "Fan Teste", email: "fan@example.test", whatsapp: "11900000002" };
type ProductOrderInput = Parameters<typeof createProductOrder>[0];

beforeEach(() => {
  st.products.clear();
  st.cantina.clear();
  st.coupons = [];
  st.orders = [];
  st.orderItems = [];
  st.couponUsages = 0;
  st.payments = [];
  st.log = [];
  st.gatewayCalls = 0;
  (st as { couponFullOnClaim?: boolean }).couponFullOnClaim = false;
  st.products.set(A, { id: A, name: "Camisa", price_cents: 10000, sale_price_cents: null, sale_ends_at: null, active: true, stock: 3 });
  st.products.set(B, { id: B, name: "Caneca", price_cents: 5000, sale_price_cents: null, sale_ends_at: null, active: true, stock: 0 });
  st.coupons.push({
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", code: "PROMO10", description: null, discount_type: "fixed", discount_value: 1000,
    min_order_cents: 0, max_usages: 1, max_usages_per_customer: null, usage_count: 0, expires_at: null, active: true, affiliate_id: null,
  });
});

describe("estoque de produtos: tentativa que falha não segura estoque", () => {
  it("linhas repetidas são somadas: 4 x 1 unidade com estoque 3 → recusa sem baixar nada", async () => {
    const r = await createProductOrder({
      buyer: attacker,
      items: [{ productId: A, quantity: 1 }, { productId: A, quantity: 1 }, { productId: A, quantity: 1 }, { productId: A, quantity: 1 }],
      paymentMethod: "pix",
    } as ProductOrderInput);
    expect(r.success).toBe(false);
    expect(st.products.get(A)!.stock).toBe(3);
    expect(st.orders.length).toBe(0);
    // O próximo comprador consegue comprar normalmente.
    const v = await createProductOrder({ buyer: victim, items: [{ productId: A, quantity: 1 }], paymentMethod: "pix" } as ProductOrderInput);
    expect(v.success).toBe(true);
    expect(st.products.get(A)!.stock).toBe(2);
  });

  it("falha numa linha posterior devolve o estoque já baixado das anteriores", async () => {
    const r = await createProductOrder({
      buyer: attacker,
      items: [{ productId: A, quantity: 2 }, { productId: B, quantity: 1 }],
      paymentMethod: "pix",
    } as ProductOrderInput);
    expect(r.success).toBe(false);
    expect(st.products.get(A)!.stock).toBe(3);
    expect(st.orders.length).toBe(0);
    expect(st.gatewayCalls).toBe(0);
  });

  it("mais de 40 linhas distintas ou soma acima de 50 por produto → recusa sem tocar o estoque", async () => {
    const many = Array.from({ length: 41 }, () => ({ productId: A, quantity: 1 }));
    expect((await createProductOrder({ buyer: attacker, items: many, paymentMethod: "pix" } as ProductOrderInput)).success).toBe(false);
    const over = Array.from({ length: 2 }, () => ({ productId: A, quantity: 30 }));
    expect((await createProductOrder({ buyer: attacker, items: over, paymentMethod: "pix" } as ProductOrderInput)).success).toBe(false);
    expect(st.products.get(A)!.stock).toBe(3);
  });
});

describe("cupom limitado: pedido que não vinga devolve o uso", () => {
  it("pedido Pix não pago que falha libera o cupom para o próximo cliente", async () => {
    st.products.get(B)!.stock = null;
    const r = await createProductOrder({ buyer: attacker, items: [{ productId: B, quantity: 1 }], paymentMethod: "pix", couponCode: "promo10" } as ProductOrderInput);
    expect(r.success).toBe(true);
    expect(st.coupons[0].usage_count).toBe(1);
    await applyGatewayStatus(st.payments[0].id as string, st.orders[0].id as string, "failed");
    await restoreOrderStock(st.orders[0].id as string);
    expect(st.coupons[0].usage_count).toBe(0);
    expect(await validateCoupon("PROMO10", 5000, "11900000002")).toMatchObject({ valid: true });
  });

  it("cupom esgotado na reserva atômica: pedido cancelado, nada cobrado", async () => {
    st.products.get(B)!.stock = null;
    // Simula a corrida: a validação viu vaga, mas outra compra levou a última antes da reserva.
    const first = await createProductOrder({ buyer: attacker, items: [{ productId: B, quantity: 1 }], paymentMethod: "pix", couponCode: "promo10" } as ProductOrderInput);
    expect(first.success).toBe(true);
    st.coupons[0].usage_count = 0; // a validação deixa passar…
    (st as { couponFullOnClaim?: boolean }).couponFullOnClaim = true; // …mas na reserva atômica já não há vaga
    const calls = st.gatewayCalls;
    const second = await createProductOrder({ buyer: victim, items: [{ productId: B, quantity: 1 }], paymentMethod: "pix", couponCode: "promo10" } as ProductOrderInput);
    expect(second.success).toBe(false);
    expect(st.gatewayCalls).toBe(calls);
    expect(st.orders.at(-1)!.status).toBe("cancelled");
  });
});
