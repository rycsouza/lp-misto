import { describe, expect, it } from "vitest";
import { contrastRatio } from "./card-visual";
import {
  arrangeWall,
  sortByTier,
  WALL_TIER_PALETTE,
  wallCardFill,
  wallCounterText,
  wallPaletteAt,
  wallRank,
  wallTierCount,
  wallTileStyle,
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

describe("tamanho do tile por posição (mosaico)", () => {
  it("o topo é o maior (~20% acima do meio) e a entrada a menor", () => {
    expect(wallTileStyle("top").size).toBe("size-17 sm:size-22");
    expect(wallTileStyle("mid").size).toBe("size-14 sm:size-18");
    expect(wallTileStyle("entry").size).toBe("size-13 sm:size-17");
  });

  it("o anel é mais grosso no topo (3 px), médio no meio (2 px) e fino na entrada (1 px)", () => {
    expect(wallTileStyle("top").ringPx).toBe(3);
    expect(wallTileStyle("mid").ringPx).toBe(2);
    expect(wallTileStyle("entry").ringPx).toBe(1);
  });
});

describe("ordem do mosaico: topo espalhado", () => {
  const tiers = (list: { name: string; tier: number }[]) => list.map((i) => i.tier);

  it("mantém todos os itens, sem mutar a lista original", () => {
    const items = [
      { name: "a", tier: 2 },
      { name: "b", tier: 0 },
      { name: "c", tier: 1 },
      { name: "d", tier: 0 },
    ];
    const out = arrangeWall(items);
    expect(out.length).toBe(4);
    expect(out.map((i) => i.name).sort()).toEqual(["a", "b", "c", "d"]);
    expect(items.map((i) => i.name)).toEqual(["a", "b", "c", "d"]);
  });

  it("os do topo ficam espalhados (não colados) ao longo da ordem", () => {
    const items = [
      ...Array.from({ length: 4 }, (_, i) => ({ name: `T${i}`, tier: 0 })),
      ...Array.from({ length: 12 }, (_, i) => ({ name: `M${i}`, tier: 1 })),
    ];
    const out = arrangeWall(items);
    const idx = out.flatMap((item, i) => (item.tier === 0 ? [i] : []));
    expect(idx.length).toBe(4);
    // Espaçamento regular de 16 / 4 = 4 posições entre dois do topo.
    expect(idx).toEqual([2, 6, 10, 14]);
  });

  it("depois do topo, os demais seguem a ordem do nível (mais caro primeiro)", () => {
    const items = [
      { name: "a", tier: 2 },
      { name: "b", tier: 1 },
      { name: "c", tier: 0 },
      { name: "d", tier: 1 },
      { name: "e", tier: 2 },
    ];
    const rest = arrangeWall(items).filter((i) => i.tier !== 0);
    expect(tiers(rest)).toEqual([1, 1, 2, 2]);
  });

  it("é determinístico: a mesma entrada gera a mesma ordem", () => {
    const items = [
      { name: "x", tier: 1 },
      { name: "y", tier: 0 },
      { name: "z", tier: 2 },
    ];
    expect(arrangeWall(items)).toEqual(arrangeWall(items));
  });

  it("lista vazia devolve vazia", () => {
    expect(arrangeWall([])).toEqual([]);
  });
});

describe("contador do topo", () => {
  it("usa o N real, no singular e no plural", () => {
    expect(wallCounterText(1)).toBe("1 torcedor já é sócio");
    expect(wallCounterText(2)).toBe("2 torcedores já são sócios");
    expect(wallCounterText(50)).toBe("50 torcedores já são sócios");
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
