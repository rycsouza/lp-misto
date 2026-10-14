import { describe, it, expect } from "vitest";
import {
  cardPalette,
  cardTextColor,
  contrastRatio,
  FALLBACK_CARD_COLOR,
  INACTIVE_CARD_COLOR,
  relativeLuminance,
  safeLogoUrl,
} from "./card-visual";

describe("contraste WCAG", () => {
  it("luminância de preto e branco nos extremos", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("branco sobre preto dá razão máxima (21:1)", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
  });

  it("texto claro em fundo escuro e escuro em fundo claro", () => {
    expect(cardTextColor("#000000")).toBe("#ffffff");
    expect(cardTextColor("#1e3a8a")).toBe("#ffffff");
    expect(cardTextColor("#ffffff")).toBe("#000000");
    expect(cardTextColor("#ffff00")).toBe("#000000");
  });

  it("cor dourada padrão do clube usa texto escuro", () => {
    expect(cardTextColor(FALLBACK_CARD_COLOR)).toBe("#000000");
  });

  it("qualquer cor de base e a ponta do gradiente ficam com contraste >= 4.5:1 (AA)", () => {
    // Grade de 16 níveis por canal (4096 cores), incluindo extremos.
    const levels = Array.from({ length: 16 }, (_, i) => Math.round((i * 255) / 15));
    for (const r of levels) for (const g of levels) for (const b of levels) {
      const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      const palette = cardPalette(hex, true);
      const stops = palette.background.match(/#[0-9a-f]{6}/g) ?? [];
      expect(stops).toHaveLength(2);
      for (const stop of stops) {
        expect(contrastRatio(palette.text, stop)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("cardPalette", () => {
  it("usa a cor do plano quando válida (normalizada em minúsculas)", () => {
    expect(cardPalette("#C19A5A", true).background).toContain("#c19a5a");
  });

  it("sem cor válida no plano nem no clube, usa a cor padrão", () => {
    expect(cardPalette(null, true).background).toContain(FALLBACK_CARD_COLOR);
    expect(cardPalette("red", true).background).toContain(FALLBACK_CARD_COLOR);
    expect(cardPalette("#ZZZZZZ", true).background).toContain(FALLBACK_CARD_COLOR);
  });

  it("sem benefício, ignora a cor do plano e usa o cinza neutro", () => {
    const p = cardPalette("#ff0000", false);
    expect(p.background).toContain(INACTIVE_CARD_COLOR);
    expect(p.background).not.toContain("#ff0000");
  });

  it("o selo sobre o cartão tem o mesmo lado de contraste do texto", () => {
    expect(cardPalette("#000000", true).pill).toContain("0, 0, 0");
    expect(cardPalette("#ffffff", true).pill).toContain("255, 255, 255");
  });
});

describe("safeLogoUrl", () => {
  it("aceita http(s) absoluto e caminho relativo da aplicação", () => {
    expect(safeLogoUrl("https://cdn.exemplo.com.br/logo.png")).toBe("https://cdn.exemplo.com.br/logo.png");
    expect(safeLogoUrl("  /uploads/logo.svg  ")).toBe("/uploads/logo.svg");
  });

  it("rejeita esquemas perigosos, URL protocolo-relativa e vazio", () => {
    expect(safeLogoUrl("javascript:alert(1)")).toBeNull();
    expect(safeLogoUrl("data:image/svg+xml,<svg onload=alert(1)>")).toBeNull();
    expect(safeLogoUrl("//evil.example/x.png")).toBeNull();
    expect(safeLogoUrl("/\\evil.example/x.png")).toBeNull();
    expect(safeLogoUrl("https://exemplo.com/logo com espaço.png")).toBeNull();
    expect(safeLogoUrl("   ")).toBeNull();
    expect(safeLogoUrl(undefined)).toBeNull();
  });
});
