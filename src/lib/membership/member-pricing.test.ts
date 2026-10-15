import { describe, it, expect } from "vitest";
import {
  checkoutTotalCents,
  computeMemberDiscount,
  memberDiscountCents,
  memberUnitPriceCents,
} from "./member-pricing";

const PRICING = { ticketDiscountPct: 15, productDiscountPct: 10 };

describe("computeMemberDiscount (regra do servidor)", () => {
  it("arredonda ao centavo mais próximo", () => {
    expect(computeMemberDiscount(3333, 10)).toBe(333);
    expect(computeMemberDiscount(9999, 10)).toBe(1000);
    expect(computeMemberDiscount(3990, 15)).toBe(599);
  });

  it("0% e base zero → 0", () => {
    expect(computeMemberDiscount(10000, 0)).toBe(0);
    expect(computeMemberDiscount(0, 10)).toBe(0);
    expect(computeMemberDiscount(-500, 10)).toBe(0);
  });

  it("100% devolve a base inteira; acima de 100 e abaixo de 0 são limitados", () => {
    expect(computeMemberDiscount(12345, 100)).toBe(12345);
    expect(computeMemberDiscount(12345, 150)).toBe(12345);
    expect(computeMemberDiscount(12345, -5)).toBe(0);
  });
});

describe("memberDiscountCents", () => {
  it("sem sessão/benefício → 0", () => {
    expect(memberDiscountCents(null, "products", 10000)).toBe(0);
    expect(memberDiscountCents(undefined, "tickets", 10000)).toBe(0);
  });

  it("usa o percentual do tipo certo (ingresso × produto)", () => {
    expect(memberDiscountCents(PRICING, "tickets", 10000)).toBe(1500);
    expect(memberDiscountCents(PRICING, "products", 10000)).toBe(1000);
  });

  it("plano sem desconto naquele tipo → 0", () => {
    expect(memberDiscountCents({ ticketDiscountPct: 0, productDiscountPct: 10 }, "tickets", 10000)).toBe(0);
  });
});

describe("memberUnitPriceCents (preço unitário exibido)", () => {
  it("0% mantém o preço", () => {
    expect(memberUnitPriceCents(4990, 0)).toBe(4990);
  });

  it("desconta a unidade pelo mesmo arredondamento", () => {
    expect(memberUnitPriceCents(10000, 10)).toBe(9000);
    expect(memberUnitPriceCents(3333, 10)).toBe(3000);
  });
});

describe("checkoutTotalCents (ordem do servidor: subtotal − cupom − sócio − automático + frete)", () => {
  it("sem nenhum desconto, o total é o subtotal", () => {
    expect(checkoutTotalCents({ subtotalCents: 4990 })).toBe(4990);
  });

  it("produtos com sócio, sem cupom", () => {
    // 3 × R$ 49,90: sócio 10% sobre 14970 = 1497 → 13473
    const subtotalCents = 3 * 4990;
    const memberDiscountCents = computeMemberDiscount(subtotalCents, 10);
    expect(checkoutTotalCents({ subtotalCents, memberDiscountCents })).toBe(13473);
  });

  it("produtos com sócio e cupom: os dois abatem do mesmo subtotal (sem composição)", () => {
    // subtotal 14970 − cupom 1000 − sócio 1497 = 12473; frete 2500 entra depois
    expect(
      checkoutTotalCents({
        subtotalCents: 14970,
        couponDiscountCents: 1000,
        memberDiscountCents: 1497,
        shippingCents: 2500,
      })
    ).toBe(14973);
  });

  it("o total nunca fica negativo; o frete não entra no clamp", () => {
    expect(checkoutTotalCents({ subtotalCents: 1000, couponDiscountCents: 900, memberDiscountCents: 900 })).toBe(0);
    expect(checkoutTotalCents({ subtotalCents: 1000, memberDiscountCents: 5000, shippingCents: 700 })).toBe(700);
  });

  it("ingressos: sócio sobre os ingressos, combo/promoção pegam o maior dos automáticos", () => {
    // 3 × R$ 80 = 24000; sócio 15% sobre ingressos = 3600; combo 2000 vs promo 3000 → promo
    const ticketsCents = 24000;
    const memberDiscountCents = computeMemberDiscount(ticketsCents, 15);
    expect(memberDiscountCents).toBe(3600);
    expect(checkoutTotalCents({ subtotalCents: ticketsCents, memberDiscountCents, autoDiscountCents: 3000 })).toBe(17400);
    expect(checkoutTotalCents({ subtotalCents: ticketsCents, memberDiscountCents, autoDiscountCents: 2000 })).toBe(18400);
  });

  it("upsell entra no subtotal (cupom e promoção) mas NÃO no desconto de sócio", () => {
    // itens 10000 + upsell 2000: sócio 15% só sobre 10000 = 1500 (não 1800)
    const itemsCents = 10000;
    const subtotalCents = itemsCents + 2000;
    const memberDiscountCents = computeMemberDiscount(itemsCents, 15);
    expect(memberDiscountCents).toBe(1500);
    expect(checkoutTotalCents({ subtotalCents, memberDiscountCents })).toBe(10500);
  });

  it("arredondamento: a soma por unidade pode diferir 1 centavo do total do subtotal (o total vale)", () => {
    // 3 × R$ 33,33 = 9999; sócio 10% sobre o subtotal = 1000 → total 8999.
    // Exibir por unidade daria 3 × 3000 = 9000; o cobrado é o do subtotal.
    const subtotalCents = 3 * 3333;
    const memberDiscountCents = computeMemberDiscount(subtotalCents, 10);
    expect(checkoutTotalCents({ subtotalCents, memberDiscountCents })).toBe(8999);
    expect(3 * memberUnitPriceCents(3333, 10)).toBe(9000);
  });
});
