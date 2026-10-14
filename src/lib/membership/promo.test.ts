import { describe, it, expect } from "vitest";
import {
  addOneMonthBrasilia,
  decidePromo,
  freeMonthUntilLabel,
  isPromoCandidate,
  promoAppliesToGateway,
  type PromoDecisionInput,
} from "./promo";

const VIGENTE = { firstMonthFree: true, promoEndsAt: null };
const BASE: PromoDecisionInput = {
  plan: VIGENTE,
  paymentMethod: "card",
  gatewaySlug: "asaas",
  eligible: true,
  acceptFullPriceIfUnavailable: false,
  today: "2026-10-14",
};

describe("addOneMonthBrasilia", () => {
  it("mesmo dia do mês seguinte", () => {
    expect(addOneMonthBrasilia("2026-10-14")).toBe("2026-11-14");
  });

  it("31/01 → 28/02 (ano comum) e 29/02 em ano bissexto", () => {
    expect(addOneMonthBrasilia("2026-01-31")).toBe("2026-02-28");
    expect(addOneMonthBrasilia("2028-01-31")).toBe("2028-02-29");
  });

  it("29/02 (bissexto) → 29/03", () => {
    expect(addOneMonthBrasilia("2028-02-29")).toBe("2028-03-29");
  });

  it("31/12 → 31/01 do ano seguinte", () => {
    expect(addOneMonthBrasilia("2026-12-31")).toBe("2027-01-31");
  });

  it("30 de abril → 30 de maio (dia que existe)", () => {
    expect(addOneMonthBrasilia("2026-04-30")).toBe("2026-05-30");
  });

  it("rejeita data fora do formato AAAA-MM-DD", () => {
    expect(() => addOneMonthBrasilia("14/10/2026")).toThrow();
    expect(() => addOneMonthBrasilia("2026-10-14T00:00:00Z")).toThrow();
  });
});

describe("promoAppliesToGateway", () => {
  it("só gateways Asaas têm promoção", () => {
    expect(promoAppliesToGateway("asaas")).toBe(true);
    expect(promoAppliesToGateway("mercadopago")).toBe(false);
    expect(promoAppliesToGateway("mock")).toBe(false);
    expect(promoAppliesToGateway(null)).toBe(false);
  });
});

describe("decidePromo", () => {
  it("cartão + Asaas + vigente + elegível → aplica, 1ª cobrança em 1 mês", () => {
    expect(decidePromo(BASE)).toEqual({ action: "apply", firstDueDate: "2026-11-14" });
  });

  it("PIX não aplica (cobra normal)", () => {
    expect(decidePromo({ ...BASE, paymentMethod: "pix" })).toEqual({ action: "none" });
  });

  it("Mercado Pago não aplica", () => {
    expect(decidePromo({ ...BASE, gatewaySlug: "mercadopago" })).toEqual({ action: "none" });
  });

  it("promoção vencida não aplica", () => {
    const plan = { firstMonthFree: true, promoEndsAt: new Date("2000-01-01T00:00:00Z") };
    expect(decidePromo({ ...BASE, plan })).toEqual({ action: "none" });
  });

  it("plano sem promoção não aplica", () => {
    expect(decidePromo({ ...BASE, plan: { firstMonthFree: false, promoEndsAt: null } })).toEqual({ action: "none" });
  });

  it("já usada e cliente não confirmou → bloqueia (sem cobrança)", () => {
    expect(decidePromo({ ...BASE, eligible: false })).toEqual({ action: "blocked" });
  });

  it("já usada e cliente confirmou a cobrança cheia → cobra hoje", () => {
    expect(decidePromo({ ...BASE, eligible: false, acceptFullPriceIfUnavailable: true })).toEqual({
      action: "full_price_after_use",
    });
  });

  it("sem promoção aplicável, a elegibilidade e o aceite não mudam nada", () => {
    expect(decidePromo({ ...BASE, paymentMethod: "pix", eligible: false })).toEqual({ action: "none" });
  });

  it("isPromoCandidate exige cartão, Asaas e promoção vigente", () => {
    expect(isPromoCandidate({ plan: VIGENTE, paymentMethod: "card", gatewaySlug: "asaas" })).toBe(true);
    expect(isPromoCandidate({ plan: VIGENTE, paymentMethod: "pix", gatewaySlug: "asaas" })).toBe(false);
    expect(isPromoCandidate({ plan: VIGENTE, paymentMethod: "card", gatewaySlug: "mercadopago" })).toBe(false);
  });
});

describe("freeMonthUntilLabel (admin)", () => {
  const now = new Date("2026-10-14T15:00:00Z");

  it("mês grátis em curso, sem pagamento → 'Mês grátis até dd/mm'", () => {
    expect(
      freeMonthUntilLabel({ trialEndsAt: new Date("2026-11-14T15:00:00Z"), hasPaid: false }, now)
    ).toBe("Mês grátis até 14/11");
  });

  it("já pagou → sem rótulo", () => {
    expect(freeMonthUntilLabel({ trialEndsAt: new Date("2026-11-14T15:00:00Z"), hasPaid: true }, now)).toBeNull();
  });

  it("sem trial ou trial já encerrado → sem rótulo", () => {
    expect(freeMonthUntilLabel({ trialEndsAt: null, hasPaid: false }, now)).toBeNull();
    expect(freeMonthUntilLabel({ trialEndsAt: new Date("2026-10-01T15:00:00Z"), hasPaid: false }, now)).toBeNull();
  });
});
