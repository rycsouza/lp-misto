import { describe, it, expect } from "vitest";
import {
  automaticBenefitTexts,
  buildPlanBenefitLines,
  endOfDaySaoPaulo,
  highlightLabelOf,
  isFirstMonthPromoActive,
  promoEndDateInputValue,
  promoUntilLabel,
  safeCardColor,
} from "./plan-benefits";

const BASE = { ticketDiscountPct: 0, productDiscountPct: 0, freeTicketsPerHomeGame: 0 };

describe("automaticBenefitTexts", () => {
  it("sem campos do plano não gera benefício automático", () => {
    expect(automaticBenefitTexts(BASE)).toEqual([]);
  });

  it("gera desconto em produtos, ingressos e ingressos grátis (singular e plural)", () => {
    expect(
      automaticBenefitTexts({ ticketDiscountPct: 5, productDiscountPct: 10, freeTicketsPerHomeGame: 1 })
    ).toEqual([
      "10% de desconto em produtos",
      "5% de desconto em ingressos",
      "1 ingresso grátis por jogo em casa",
    ]);
    expect(automaticBenefitTexts({ ...BASE, freeTicketsPerHomeGame: 2 })).toEqual([
      "2 ingressos grátis por jogo em casa",
    ]);
  });

  it("percentual zero não aparece", () => {
    expect(automaticBenefitTexts({ ...BASE, productDiscountPct: 0, ticketDiscountPct: 0 })).toEqual([]);
  });
});

describe("buildPlanBenefitLines", () => {
  it("coloca os automáticos antes dos benefícios e usa o detalhe no texto", () => {
    const lines = buildPlanBenefitLines(
      { ...BASE, productDiscountPct: 15 },
      [
        { id: "b1", label: "Carteirinha digital" },
        { id: "b2", label: "Nome da empresa no painel de LED", detail: " 3 segundos " },
        { id: "b3", label: "Meet & greet", detail: "   " },
      ]
    );
    expect(lines).toEqual([
      { key: "auto-0", text: "15% de desconto em produtos", automatic: true },
      { key: "b1", text: "Carteirinha digital", automatic: false },
      { key: "b2", text: "Nome da empresa no painel de LED: 3 segundos", automatic: false },
      { key: "b3", text: "Meet & greet", automatic: false },
    ]);
  });
});

describe("highlightLabelOf", () => {
  it("usa o texto padrão quando vazio, nulo ou só espaços", () => {
    expect(highlightLabelOf(null)).toBe("MAIS POPULAR");
    expect(highlightLabelOf(undefined)).toBe("MAIS POPULAR");
    expect(highlightLabelOf("   ")).toBe("MAIS POPULAR");
    expect(highlightLabelOf(" RECOMENDADO ")).toBe("RECOMENDADO");
  });
});

describe("safeCardColor", () => {
  it("aceita apenas #RRGGBB e normaliza para minúsculas", () => {
    expect(safeCardColor("#C19A5A")).toBe("#c19a5a");
    expect(safeCardColor("#c19a5a")).toBe("#c19a5a");
  });

  it("rejeita formatos inválidos e valores que tentam sair do atributo", () => {
    expect(safeCardColor("red")).toBeNull();
    expect(safeCardColor("#fff")).toBeNull();
    expect(safeCardColor("#c19a5a;background:url(x)")).toBeNull();
    expect(safeCardColor("javascript:alert(1)")).toBeNull();
    expect(safeCardColor(null)).toBeNull();
    expect(safeCardColor("")).toBeNull();
  });
});

describe("isFirstMonthPromoActive", () => {
  const now = new Date("2026-10-14T12:00:00Z");

  it("desligada quando firstMonthFree é falso", () => {
    expect(isFirstMonthPromoActive({ firstMonthFree: false, promoEndsAt: null }, now)).toBe(false);
  });

  it("ativa sem data-limite", () => {
    expect(isFirstMonthPromoActive({ firstMonthFree: true, promoEndsAt: null }, now)).toBe(true);
  });

  it("ativa só enquanto a data-limite não passou", () => {
    expect(
      isFirstMonthPromoActive({ firstMonthFree: true, promoEndsAt: new Date("2026-12-31T02:59:59Z") }, now)
    ).toBe(true);
    expect(
      isFirstMonthPromoActive({ firstMonthFree: true, promoEndsAt: new Date("2026-10-01T02:59:59Z") }, now)
    ).toBe(false);
    expect(
      isFirstMonthPromoActive({ firstMonthFree: true, promoEndsAt: "2026-10-01T02:59:59.000Z" }, now)
    ).toBe(false);
  });
});

describe("promoUntilLabel", () => {
  it("formata dd/mm no fuso de Brasília", () => {
    // 2026-12-31 23:59 em Brasília = 2027-01-01 02:59 UTC: ainda é 31/12.
    expect(promoUntilLabel("2027-01-01T02:59:59.000Z")).toBe("até 31/12");
  });

  it("null sem data-limite e para datas inválidas", () => {
    expect(promoUntilLabel(null)).toBeNull();
    expect(promoUntilLabel("nao-e-data")).toBeNull();
  });
});

describe("endOfDaySaoPaulo", () => {
  it("devolve 23:59:59 de Brasília (02:59:59 UTC do dia seguinte)", () => {
    expect(endOfDaySaoPaulo("2026-12-31")?.toISOString()).toBe("2027-01-01T02:59:59.000Z");
  });

  it("rejeita formato errado e datas que não existem", () => {
    expect(endOfDaySaoPaulo("31/12/2026")).toBeNull();
    expect(endOfDaySaoPaulo("2026-02-30")).toBeNull();
    expect(endOfDaySaoPaulo("2026-13-01")).toBeNull();
    expect(endOfDaySaoPaulo("2026-12-31T00:00:00Z")).toBeNull();
  });
});

describe("promoEndDateInputValue", () => {
  it("volta ao dia de Brasília (não ao dia UTC)", () => {
    expect(promoEndDateInputValue("2027-01-01T02:59:59.000Z")).toBe("2026-12-31");
    expect(promoEndDateInputValue(null)).toBe("");
    expect(promoEndDateInputValue("lixo")).toBe("");
  });
});
