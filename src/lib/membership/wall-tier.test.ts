import { describe, expect, it } from "vitest";
import { contrastRatio } from "./card-visual";
import {
  sortByTier,
  WALL_TIER_PALETTE,
  wallCardFill,
  wallCardSizeClass,
  wallPaletteAt,
  wallRank,
  wallTierCount,
  withClubColorFallback,
} from "./wall-tier";

const AA = 4.5;

describe("posição do nível (topo, meio, entrada)", () => {
  it("o nível 0 é sempre o topo, mesmo sozinho", () => {
    expect(wallRank(0, 1)).toBe("top");
    expect(wallRank(0, 3)).toBe("top");
  });

  it("com dois níveis, o 1 é a entrada; com três, o 1 é meio e o 2 é a entrada", () => {
    expect(wallRank(1, 2)).toBe("entry");
    expect(wallRank(1, 3)).toBe("mid");
    expect(wallRank(2, 3)).toBe("entry");
  });

  it("contagem de níveis: a partir do maior nível presente; vazio vale 0", () => {
    expect(wallTierCount([0, 0, 2, 1])).toBe(3);
    expect(wallTierCount([])).toBe(0);
  });
});

describe("tamanho do cartão por posição", () => {
  it("o topo é o maior, a entrada o menor e o meio fica entre os dois", () => {
    expect(wallCardSizeClass(0, 3)).toBe("w-44 sm:w-56");
    expect(wallCardSizeClass(1, 3)).toBe("w-40 sm:w-48");
    expect(wallCardSizeClass(2, 3)).toBe("w-36 sm:w-40");
  });

  it("o mínimo continua w-36 (144 px), que dimensiona as faixas", () => {
    for (let tier = 0; tier < 6; tier++) {
      expect(wallCardSizeClass(tier, 6)).toMatch(/^w-(3[6-9]|4\d|5\d)\b/);
    }
  });
});

describe("ordem do topo para a entrada", () => {
  it("ordena por nível e mantém a ordem do dia dentro do mesmo nível", () => {
    const items = [
      { name: "a", tier: 2 },
      { name: "b", tier: 0 },
      { name: "c", tier: 1 },
      { name: "d", tier: 0 },
      { name: "e", tier: 2 },
    ];
    expect(sortByTier(items).map((i) => i.name)).toEqual(["b", "d", "c", "a", "e"]);
  });

  it("não altera a lista original", () => {
    const items = [{ tier: 1 }, { tier: 0 }];
    sortByTier(items);
    expect(items.map((i) => i.tier)).toEqual([1, 0]);
  });
});

describe("paleta de reserva por nível (quando o plano não tem cor)", () => {
  it("nível 0 é ouro, 1 prata, 2 bronze; cores fixas e nunca cinza-sobre-cinza", () => {
    expect(wallCardFill(null, 0).accent).toBe("#c9a227");
    expect(wallCardFill(null, 1).accent).toBe("#cbd5e1");
    expect(wallCardFill(null, 2).accent).toBe("#b45309");
  });

  it("níveis além da paleta usam o último tom neutro (sem erro)", () => {
    const last = WALL_TIER_PALETTE[WALL_TIER_PALETTE.length - 1];
    expect(wallCardFill(null, 99).accent).toBe(last.from);
    expect(wallPaletteAt(99).from).toBe(last.from);
  });

  it("cor de plano inválida cai na paleta (sem CSS injetado)", () => {
    const fill = wallCardFill("red;background:url(https://evil.test/x)", 0);
    expect(fill.background).not.toContain("evil.test");
    expect(fill.background).not.toContain("url(");
    expect(fill.accent).toBe("#c9a227");
  });

  it("todo par da paleta tem texto com contraste AA nas duas pontas", () => {
    WALL_TIER_PALETTE.forEach((_, index) => {
      const { from, to, text } = wallPaletteAt(index);
      expect(Math.min(contrastRatio(from, text), contrastRatio(to, text)), `nível ${index}`).toBeGreaterThanOrEqual(AA);
    });
  });
});

describe("preenchimento com a cor do plano", () => {
  it("cor válida vira o destaque e o gradiente; texto com contraste AA", () => {
    const fill = wallCardFill("#1F3A93", 3);
    expect(fill.accent).toBe("#1f3a93");
    expect(fill.background).toContain("#1f3a93");
    expect(contrastRatio(fill.accent, fill.text)).toBeGreaterThanOrEqual(AA);
  });

  it("cor do plano tem prioridade sobre a paleta, mesmo no topo", () => {
    expect(wallCardFill("#1f3a93", 0).accent).toBe("#1f3a93");
  });
});

describe("withClubColorFallback", () => {
  const cards = [
    { name: "A", cardColor: "#1d4ed8" },
    { name: "B", cardColor: null },
  ];
  it("plano sem cor usa a cor do clube; plano com cor mantém a dele", () => {
    expect(withClubColorFallback(cards, "#c9a227").map((c) => c.cardColor)).toEqual(["#1d4ed8", "#c9a227"]);
  });
  it("clube sem cor válida → mantém null (a paleta do nível entra)", () => {
    expect(withClubColorFallback(cards, "hsl(1 2% 3%)").map((c) => c.cardColor)).toEqual(["#1d4ed8", null]);
    expect(withClubColorFallback(cards, "red;background:url(x)").map((c) => c.cardColor)).toEqual(["#1d4ed8", null]);
  });
});
