import { describe, it, expect } from "vitest";
import { SOCIO_BENEFITS, SOCIO_PLANS } from "./socios";

/**
 * Planilha oficial de planos (fonte da verdade). Copiada à mão de propósito: se
 * alguém mexer nos dados do seed sem atualizar a planilha, este teste quebra.
 */
const PLANILHA = {
  raiz: { priceCents: 990, productDiscountPct: 5, ticketDiscountPct: 0, freeTicketsPerHomeGame: 0 },
  torcedor: { priceCents: 1990, productDiscountPct: 7, ticketDiscountPct: 0, freeTicketsPerHomeGame: 0 },
  carcara: { priceCents: 4990, productDiscountPct: 10, ticketDiscountPct: 0, freeTicketsPerHomeGame: 0 },
  elite: { priceCents: 7990, productDiscountPct: 12, ticketDiscountPct: 0, freeTicketsPerHomeGame: 1 },
  empresarial: { priceCents: 24900, productDiscountPct: 15, ticketDiscountPct: 0, freeTicketsPerHomeGame: 2 },
} as const;

const TODOS = ["raiz", "torcedor", "carcara", "elite", "empresarial"];

/** Matriz da planilha: benefício → planos que o incluem (com o detalhe, quando houver). */
const MATRIZ: { label: string; planos: string[]; detail?: string }[] = [
  { label: "Carteirinha digital", planos: TODOS },
  { label: "Nome no mural digital do clube", planos: TODOS },
  { label: "Ingresso em experiências (treino aberto, visitas, feijoadas)", planos: ["carcara", "elite", "empresarial"] },
  { label: "Acesso a área exclusiva no estádio (se possível — ver termo de adesão)", planos: ["elite", "empresarial"] },
  { label: "Meet & greet com jogadores", planos: ["elite", "empresarial"] },
  { label: "Divulgação da empresa nas redes sociais do clube", planos: ["empresarial"] },
  { label: "Networking com diretoria e patrocinadores", planos: ["empresarial"] },
  { label: "Nome da empresa no painel de LED", planos: ["empresarial"], detail: "3 segundos" },
];

describe("seed de sócio-torcedor = planilha", () => {
  it("tem os 5 planos, com slugs únicos e ordem 1..5", () => {
    expect(SOCIO_PLANS.map((p) => p.slug)).toEqual(Object.keys(PLANILHA));
    expect(SOCIO_PLANS.map((p) => p.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it.each(Object.entries(PLANILHA))("%s: preço, descontos e ingressos grátis batem", (slug, esperado) => {
    const plano = SOCIO_PLANS.find((p) => p.slug === slug);
    expect(plano).toBeDefined();
    expect({
      priceCents: plano!.priceCents,
      productDiscountPct: plano!.productDiscountPct,
      ticketDiscountPct: plano!.ticketDiscountPct,
      freeTicketsPerHomeGame: plano!.freeTicketsPerHomeGame,
    }).toEqual(esperado);
  });

  it("só o Carcará tem destaque, com etiqueta MAIS POPULAR", () => {
    const destaques = SOCIO_PLANS.filter((p) => p.highlight);
    expect(destaques.map((p) => p.slug)).toEqual(["carcara"]);
    expect(destaques[0].highlightLabel).toBe("MAIS POPULAR");
    expect(SOCIO_PLANS.filter((p) => p.highlightLabel !== null).map((p) => p.slug)).toEqual(["carcara"]);
  });

  it("nenhum plano tem promoção 1º mês grátis nem plano inativo no seed", () => {
    expect(SOCIO_PLANS.every((p) => !p.firstMonthFree && p.active)).toBe(true);
  });

  it("cores de cartão são #RRGGBB e descrições são curtas e preenchidas", () => {
    for (const p of SOCIO_PLANS) {
      expect(p.cardColor).toMatch(/^#[0-9a-f]{6}$/);
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.description.length).toBeLessThanOrEqual(140);
    }
  });

  it("benefícios textuais batem com a matriz da planilha (planos, ordem e detalhe)", () => {
    expect(SOCIO_BENEFITS.map((b) => b.label)).toEqual(MATRIZ.map((m) => m.label));
    SOCIO_BENEFITS.forEach((b, i) => {
      expect(b.order).toBe(i + 1);
      expect(b.planSlugs).toEqual(MATRIZ[i].planos);
      expect(b.detail).toBe(MATRIZ[i].detail);
    });
  });

  it("descontos e ingressos grátis NÃO são linhas de benefício (vêm dos campos do plano)", () => {
    for (const b of SOCIO_BENEFITS) {
      expect(b.label).not.toMatch(/desconto|gratuit/i);
    }
  });
});
