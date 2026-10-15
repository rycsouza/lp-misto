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

describe("cardPalette — precedência da cor de base", () => {
  it("a cor do PLANO vence a do clube", () => {
    const p = cardPalette("#3F6212", true, "#C19A5A");
    expect(p.background).toContain("linear-gradient(135deg, #3f6212 0%");
    expect(p.background).not.toContain("#c19a5a");
  });

  it("sem cor de plano, usa a cor do CLUBE", () => {
    expect(cardPalette(null, true, "#123456").background).toContain("#123456");
  });

  it("cor de plano inválida conta como ausente: cai no clube", () => {
    expect(cardPalette("red", true, "#123456").background).toContain("#123456");
  });

  it("sem cor de plano nem de clube, usa o dourado de reserva", () => {
    expect(cardPalette(undefined, true).background).toContain(FALLBACK_CARD_COLOR);
    expect(cardPalette(null, true, null).background).toContain(FALLBACK_CARD_COLOR);
  });

  it("sem benefício, ignora as duas cores e usa o cinza neutro", () => {
    const p = cardPalette("#3F6212", false, "#C19A5A");
    expect(p.background).toContain(INACTIVE_CARD_COLOR);
    expect(p.background).not.toContain("#3f6212");
    expect(p.background).not.toContain("#c19a5a");
  });
});

describe("cardPalette — gradiente vivo e sombra do texto", () => {
  const stops = (bg: string) => bg.match(/#[0-9a-f]{6}/g) ?? [];
  /** Saturação HSV (0 = cinza, 1 = cor pura): não muda ao escurecer a cor. */
  const spread = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const max = Math.max(...c);
    return (max - Math.min(...c)) / max;
  };

  it("a cor do plano é exatamente o início do gradiente (identidade preservada)", () => {
    expect(stops(cardPalette("#3F6212", true).background)[0]).toBe("#3f6212");
  });

  it("com texto claro, a ponta é mais escura que a base e não perde saturação (não fica cinza)", () => {
    const [base, end] = stops(cardPalette("#3F6212", true).background) as [string, string];
    expect(relativeLuminance(end)).toBeLessThan(relativeLuminance(base));
    expect(spread(end)).toBeGreaterThanOrEqual(spread(base));
  });

  it("sombra do texto: escura com texto claro, clara com texto escuro", () => {
    expect(cardPalette("#000000", true).textShadow).toContain("0, 0, 0");
    expect(cardPalette("#ffffff", true).textShadow).toContain("255, 255, 255");
  });
});
