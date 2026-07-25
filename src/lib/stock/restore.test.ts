import { describe, it, expect } from "vitest";
import { planStockRestore } from "./restore";

describe("planStockRestore — o que devolver ao estoque", () => {
  it("ignora linhas sem referenceId (desconto/upsell)", () => {
    const ops = planStockRestore([
      { referenceId: null, quantity: 1, metadata: { isCouponDiscount: true } },
      { referenceId: null, quantity: 1, metadata: { isPromotion: true } },
      { referenceId: null, quantity: 2, metadata: { isUpsell: true } },
    ]);
    expect(ops).toEqual([]);
  });

  it("devolve produto sem variante pelo productId", () => {
    const ops = planStockRestore([
      { referenceId: "prod-1", quantity: 3, metadata: { name: "Camisa", variantId: null } },
    ]);
    expect(ops).toEqual([{ variantId: null, productId: "prod-1", quantity: 3 }]);
  });

  it("devolve pela variante quando há variantId no metadata", () => {
    const ops = planStockRestore([
      { referenceId: "prod-1", quantity: 1, metadata: { name: "Camisa", variantId: "var-9" } },
    ]);
    expect(ops).toEqual([{ variantId: "var-9", productId: "prod-1", quantity: 1 }]);
  });

  it("mistura produtos reais e ignora as linhas de desconto", () => {
    const ops = planStockRestore([
      { referenceId: "prod-1", quantity: 1, metadata: { variantId: "var-1" } },
      { referenceId: null, quantity: 1, metadata: { isCouponDiscount: true } },
      { referenceId: "prod-2", quantity: 2, metadata: { variantId: null } },
    ]);
    expect(ops).toEqual([
      { variantId: "var-1", productId: "prod-1", quantity: 1 },
      { variantId: null, productId: "prod-2", quantity: 2 },
    ]);
  });

  it("metadata ausente/estranho não quebra (trata como sem variante)", () => {
    const ops = planStockRestore([
      { referenceId: "prod-1", quantity: 1, metadata: null },
      { referenceId: "prod-2", quantity: 1, metadata: undefined as unknown },
    ]);
    expect(ops).toEqual([
      { variantId: null, productId: "prod-1", quantity: 1 },
      { variantId: null, productId: "prod-2", quantity: 1 },
    ]);
  });
});
