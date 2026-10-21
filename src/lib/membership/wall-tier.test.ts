import { describe, expect, it } from "vitest";
import { contrastRatio } from "./card-visual";
import {
  arrangeWall,
  sortByTier,
  WALL_BOB_MAX_PX,
  WALL_BOB_MIN_PX,
  WALL_DY_MAX_PX,
  WALL_ENTRY_SIZE,
  WALL_MARGIN_MAX_PX,
  WALL_MARGIN_MIN_PX,
  WALL_SCALE_SPREAD,
  WALL_TIER_PALETTE,
  WALL_TOP_SIZE,
  WALL_VAGA_SIZE,
  wallCardFill,
  wallCounterText,
  wallHash,
  wallMinSlotPx,
  wallPaletteAt,
  wallRank,
  wallRingPx,
  wallSizeAt,
  wallTierCount,
  wallTileLook,
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

describe("tamanho do tile por nível (mosaico)", () => {
  it("todas as bolhas têm o mesmo tamanho fixo (sócios de qualquer plano e vagas)", () => {
    expect(WALL_TOP_SIZE).toEqual(WALL_ENTRY_SIZE);
    expect(WALL_VAGA_SIZE).toEqual(WALL_TOP_SIZE);
    expect(WALL_SCALE_SPREAD).toBe(0);
  });
  it("com dois níveis: o topo usa o tamanho do topo e a entrada, o da entrada", () => {
    expect(wallSizeAt(0, 2)).toEqual(WALL_TOP_SIZE);
    expect(wallSizeAt(1, 2)).toEqual(WALL_ENTRY_SIZE);
  });

  it("com um nível só (ou nenhum), o tamanho é o do topo", () => {
    expect(wallSizeAt(0, 1)).toEqual(WALL_TOP_SIZE);
    expect(wallSizeAt(0, 0)).toEqual(WALL_TOP_SIZE);
  });

  it("com três ou mais níveis, o do meio tem o mesmo tamanho", () => {
    expect(wallSizeAt(1, 3)).toEqual(WALL_TOP_SIZE);
  });
  it("tamanho igual em todos os níveis, de 1 a 6 níveis, nas duas telas", () => {
    for (let tiers = 1; tiers <= 6; tiers++) {
      for (let t = 0; t < tiers; t++) expect(wallSizeAt(t, tiers)).toEqual(WALL_TOP_SIZE);
    }
  });
  it("o nível fora da faixa é limitado (não quebra nem sai do intervalo)", () => {
    expect(wallSizeAt(-3, 3)).toEqual(WALL_TOP_SIZE);
    expect(wallSizeAt(99, 3)).toEqual(WALL_ENTRY_SIZE);
  });

  it("o anel é mais grosso no topo (3 px), médio no meio (2 px) e fino na entrada (1 px)", () => {
    expect(wallRingPx("top")).toBe(3);
    expect(wallRingPx("mid")).toBe(2);
    expect(wallRingPx("entry")).toBe(1);
  });
});

describe("aparência de cada tile: determinística e variada", () => {
  const keys = Array.from({ length: 60 }, (_, i) => `socio|0|${i}|Pessoa ${i}|Elite`);

  it("o hash é estável: a mesma chave dá o mesmo número, e chaves diferentes dão números diferentes", () => {
    expect(wallHash("socio|0|1|Ana|Elite")).toBe(wallHash("socio|0|1|Ana|Elite"));
    expect(new Set(keys.map((k) => wallHash(k))).size).toBe(keys.length);
  });

  it("mesma entrada, mesmo visual (determinístico)", () => {
    expect(wallTileLook(keys[3], WALL_TOP_SIZE)).toEqual(wallTileLook(keys[3], WALL_TOP_SIZE));
  });

  it("os valores ficam dentro dos limites (deslocamento, margem, escala e flutuação)", () => {
    for (const key of keys) {
      const look = wallTileLook(key, WALL_TOP_SIZE);
      expect(look.dyPx).toBeGreaterThanOrEqual(-WALL_DY_MAX_PX);
      expect(look.dyPx).toBeLessThanOrEqual(WALL_DY_MAX_PX);
      expect(look.marginPx).toBeGreaterThanOrEqual(WALL_MARGIN_MIN_PX);
      expect(look.marginPx).toBeLessThanOrEqual(WALL_MARGIN_MAX_PX);
      expect(look.mobilePx).toBeGreaterThanOrEqual(Math.round(WALL_TOP_SIZE.mobile * (1 - WALL_SCALE_SPREAD)));
      expect(look.mobilePx).toBeLessThanOrEqual(Math.round(WALL_TOP_SIZE.mobile * (1 + WALL_SCALE_SPREAD)));
      expect(look.desktopPx).toBeGreaterThanOrEqual(Math.round(WALL_TOP_SIZE.desktop * (1 - WALL_SCALE_SPREAD)));
      expect(look.desktopPx).toBeLessThanOrEqual(Math.round(WALL_TOP_SIZE.desktop * (1 + WALL_SCALE_SPREAD)));
      expect(look.bobAmpPx).toBeGreaterThanOrEqual(WALL_BOB_MIN_PX);
      expect(look.bobAmpPx).toBeLessThanOrEqual(WALL_BOB_MAX_PX);
      expect(look.bobSec).toBeGreaterThanOrEqual(3.2);
      expect(look.bobSec).toBeLessThanOrEqual(5.6);
      expect(look.bobDelaySec).toBeLessThanOrEqual(0);
      expect(-look.bobDelaySec).toBeLessThanOrEqual(look.bobSec);
    }
  });

  it("wallMinSlotPx: margem mínima mais o menor diâmetro (-6%), igual ao espaço mínimo do tile", () => {
    expect(wallMinSlotPx(128)).toBe(WALL_MARGIN_MIN_PX + Math.round(128 * (1 - WALL_SCALE_SPREAD)));
    const look = wallTileLook(keys[0], WALL_TOP_SIZE);
    expect(look.minSlotDesktopPx).toBe(wallMinSlotPx(WALL_TOP_SIZE.desktop));
    expect(look.minSlotMobilePx).toBe(wallMinSlotPx(WALL_TOP_SIZE.mobile));
  });

  it("os mínimos valem para qualquer chave: nenhum tile fica abaixo do espaço mínimo previsto", () => {
    for (const key of keys) {
      const look = wallTileLook(key, WALL_VAGA_SIZE);
      expect(look.mobilePx).toBeGreaterThanOrEqual(look.minSlotMobilePx - WALL_MARGIN_MIN_PX);
      expect(look.desktopPx).toBeGreaterThanOrEqual(look.minSlotDesktopPx - WALL_MARGIN_MIN_PX);
      expect(look.minSlotMobilePx).toBe(WALL_MARGIN_MIN_PX + Math.round(WALL_VAGA_SIZE.mobile * (1 - WALL_SCALE_SPREAD)));
      expect(look.minSlotDesktopPx).toBe(WALL_MARGIN_MIN_PX + Math.round(WALL_VAGA_SIZE.desktop * (1 - WALL_SCALE_SPREAD)));
    }
  });

  it("há variação de posição e ritmo entre os tiles, mas o tamanho é fixo", () => {
    const looks = keys.map((k) => wallTileLook(k, WALL_TOP_SIZE));
    expect(new Set(looks.map((l) => l.dyPx)).size).toBeGreaterThan(8);
    expect(new Set(looks.map((l) => l.marginPx)).size).toBeGreaterThan(8);
    expect(new Set(looks.map((l) => l.desktopPx)).size).toBe(1);
    expect(new Set(looks.map((l) => l.mobilePx)).size).toBe(1);
    expect(new Set(looks.map((l) => l.bobSec)).size).toBeGreaterThan(8);
    expect(new Set(looks.map((l) => l.bobDelaySec)).size).toBeGreaterThan(8);
  });
  it("não há simetria: o deslocamento médio fica perto de zero e sobram posições de cada lado", () => {
    const looks = keys.map((k) => wallTileLook(k, WALL_TOP_SIZE));
    const up = looks.filter((l) => l.dyPx < 0).length;
    const down = looks.filter((l) => l.dyPx > 0).length;
    expect(up).toBeGreaterThan(5);
    expect(down).toBeGreaterThan(5);
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
