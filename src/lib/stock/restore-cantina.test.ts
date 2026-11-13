import { describe, it, expect, vi, beforeEach } from "vitest";

/** Pedido da cantina que não vingou (expirado/falho/estornado) devolve o `stock_sold`, uma vez só. */
const h = vi.hoisted(() => ({
  claimed: true,
  cantinaLines: [] as { itemId: string | null; quantity: number }[],
  released: [] as { itemId: string; quantity: number }[],
}));

vi.mock("@/lib/db/client", async () => {
  const schema = await import("@/lib/db/schema");
  const { PgDialect } = await import("drizzle-orm/pg-core");
  function chain(kind: string) {
    const st: { kind: string; where?: unknown; table?: unknown } = { kind };
    const resolve = () => {
      if (st.kind === "update" ) return h.claimed ? [{ id: "o1" }] : [];
      if (st.kind === "select" && st.table === schema.orderItems) {
        const q = new PgDialect().sqlToQuery(st.where as never);
        return q.params.includes("cantina") ? h.cantinaLines : [];
      }
      return [];
    };
    const p: Record<string, unknown> = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") return (res: (v: unknown) => unknown) => Promise.resolve(resolve()).then(res);
          return (...args: unknown[]) => {
            if (prop === "from") st.table = args[0];
            if (prop === "where") st.where = args[0];
            return p;
          };
        },
      }
    );
    return p;
  }
  return { getDb: async () => ({ select: () => chain("select"), update: () => chain("update") }) };
});
vi.mock("@/lib/cantina/stock", () => ({
  releaseCantinaStock: async (itemId: string, quantity: number) => {
    h.released.push({ itemId, quantity });
  },
}));
vi.mock("@/lib/coupon/usage", () => ({ releaseCouponUsage: async () => undefined }));

import { restoreOrderStock } from "./restore";

beforeEach(() => {
  h.claimed = true;
  h.cantinaLines = [];
  h.released = [];
});

describe("restoreOrderStock — cantina", () => {
  it("devolve cada item da cantina do pedido", async () => {
    h.cantinaLines = [
      { itemId: "item-a", quantity: 2 },
      { itemId: null, quantity: 1 },
      { itemId: "item-b", quantity: 1 },
    ];
    await restoreOrderStock("o1");
    expect(h.released).toEqual([
      { itemId: "item-a", quantity: 2 },
      { itemId: "item-b", quantity: 1 },
    ]);
  });

  it("já devolvido por outro caminho (claim perdido): não devolve de novo", async () => {
    h.claimed = false;
    h.cantinaLines = [{ itemId: "item-a", quantity: 2 }];
    await restoreOrderStock("o1");
    expect(h.released).toEqual([]);
  });
});
