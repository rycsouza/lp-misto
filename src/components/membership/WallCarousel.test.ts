import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMosaic,
  interleaveVacancies,
  MOSAIC_CAROUSEL_MAX_VACANCIES_PER_ROW,
  MOSAIC_GLOW_PX,
  MOSAIC_LABEL_ZONE_PX,
  MOSAIC_LINE_GAP_PX,
  MOSAIC_PAD_PX,
  MOSAIC_PHONE_VISIBLE_MAX_PX,
  MOSAIC_ROW_OVERLAP_PX,
  MOSAIC_ROWS,
  MOSAIC_STATIC_TARGET_TILES,
  MOSAIC_VISIBLE_CLASS,
  MOSAIC_VISIBLE_MAX_PX,
  mosaicRowMinWidthPx,
  mosaicRowPitchPx,
  mosaicRowSets,
  mosaicRuleHolds,
  popoverPosition,
  splitMosaicRows,
  WallBalloon,
  WallCarousel,
  type MosaicTile,
} from "@/components/membership/WallCarousel";
import {
  WALL_BOB_MAX_PX,
  WALL_DY_MAX_PX,
  WALL_MARGIN_MAX_PX,
  WALL_MARGIN_MIN_PX,
  WALL_SCALE_SPREAD,
  WALL_TOP_SIZE,
} from "@/lib/membership/wall-tier";
import type { WallCard } from "@/lib/membership/wall";

const CLOUD = "misto-test";
const PHOTO = `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,g_face,w_512,h_512,q_auto,f_auto/clube-a/socios/fotos/abc123`;
const ADESAO = "/socios/adesao";
const VAGA_LABEL = "Seja sócio — seu lugar no mural";

const card = (over: Partial<WallCard> = {}): WallCard => ({
  name: "Ana",
  since: "15/03/2026",
  planName: "Elite",
  cardColor: null,
  photoUrl: null,
  tier: 0,
  ...over,
});

/** Sócios do topo com nomes únicos ("Pessoa 0", "Pessoa 1"...). */
const named = (n: number, over: Partial<WallCard> = {}): WallCard[] =>
  Array.from({ length: n }, (_, i) => card({ name: `Pessoa ${i}`, ...over }));

/** Sócios em três níveis (topo, meio e entrada), em rodízio. */
const mixed = (n: number): WallCard[] =>
  Array.from({ length: n }, (_, i) => card({ name: `Pessoa ${i}`, tier: i % 3, planName: `Plano ${i % 3}` }));

const render = (list: WallCard[], extra: Partial<Parameters<typeof WallCarousel>[0]> = {}) =>
  renderToStaticMarkup(createElement(WallCarousel, { label: "Sócios de Clube A", cards: list, ...extra }));

/** Remove as cópias do loop (aria-hidden): o que sobra é o que o leitor de tela vê. */
const withoutClones = (html: string) => html.replace(/<ul aria-hidden="true"[^>]*>[\s\S]*?<\/ul>/g, "");
const clonesOf = (html: string) => html.match(/<ul aria-hidden="true"[^>]*>[\s\S]*?<\/ul>/g) ?? [];
const count = (html: string, needle: string) => html.split(needle).length - 1;
const socioNames = (tiles: MosaicTile[]) => tiles.flatMap((t) => (t.kind === "socio" ? [t.card.name] : []));
const vagaCount = (tiles: MosaicTile[]) => tiles.filter((t) => t.kind === "vaga").length;
const tilesOf = (layout: { rows: MosaicTile[][] }) => layout.rows.flat();

/**
 * Simula o marquee de UMA fileira: a faixa tem `sets` cópias da sequência (cada tile ocupa `widths[i]`
 * px, margem incluída) e anda uma sequência por vez. Em cada deslocamento de 1 px, vê quais tiles
 * tocam a área visível [0, visible] e devolve true se algum mesmo tile (mesma posição dentro da
 * sequência) aparece 2x ao mesmo tempo.
 */
function sameTileTwiceOnScreen(widths: number[], visible: number, sets: number): boolean {
  const len = widths.length;
  const starts: number[] = [];
  let acc = 0;
  for (let k = 0; k < sets * len; k++) {
    starts.push(acc);
    acc += widths[k % len];
  }
  const loop = acc / sets;
  for (let shift = 0; shift < loop; shift++) {
    const seen = new Set<number>();
    for (let k = 0; k < sets * len; k++) {
      const left = starts[k] - shift;
      const right = left + widths[k % len];
      if (right > 0 && left < visible) {
        const id = k % len;
        if (seen.has(id)) return true;
        seen.add(id);
      }
    }
  }
  return false;
}

const minWidths = (row: MosaicTile[], screen: "mobile" | "desktop") =>
  row.map((t) => (screen === "mobile" ? t.look.minSlotMobilePx : t.look.minSlotDesktopPx));

/**
 * Folga da fileira: largura mínima da sequência menos a maior bolha. Uma bolha aparece 2x na tela
 * só se essa folga for menor que a área visível (a bolha na borda aparece nas duas cópias).
 */
const rowSlack = (row: MosaicTile[], screen: "mobile" | "desktop") => {
  const widths = minWidths(row, screen);
  return widths.reduce((sum, w) => sum + w, 0) - Math.max(...widths);
};

describe("mosaico: constantes, modos e vagas", () => {
  it("duas fileiras no carrossel; 12 bolhas no modo estático; largura max-w-6xl (1152 px)", () => {
    expect(MOSAIC_ROWS).toBe(2);
    expect(MOSAIC_STATIC_TARGET_TILES).toBe(12);
    expect(MOSAIC_VISIBLE_CLASS).toBe("max-w-6xl");
    expect(MOSAIC_VISIBLE_MAX_PX).toBe(72 * 16);
    expect(MOSAIC_PHONE_VISIBLE_MAX_PX).toBe(639 - 2 * 16);
  });

  it("o tamanho do tile vem por variáveis CSS (--tile-m, --tile-d) e a margem é por tile (--mx)", () => {
    const html = render(named(5));
    expect(html).toContain("--tile-m:");
    expect(html).toContain("--tile-d:");
    expect(html).toContain("--mx:");
    expect(html).toContain("--dy:");
    // Sem o slot fixo antigo (w-17 / sm:w-24): o tamanho depende do nível e da bolha.
    expect(html).not.toContain("w-17 sm:w-24");
  });

  it("a área visível (max-w-6xl) vai para o HTML", () => {
    const html = render(named(5));
    expect(html).toMatch(new RegExp(`<div role="region" aria-label="[^"]*" class="[^"]*${MOSAIC_VISIBLE_CLASS}[^"]*"`));
  });

  it("modo estático com 4 sócios: 12 bolhas (4 sócios + 8 vagas), cada sócio uma vez, sem cópias nem marquee", () => {
    const layout = buildMosaic(named(4));
    expect(layout.mode).toBe("static");
    const tiles = tilesOf(layout);
    expect(tiles.length).toBe(12);
    expect(vagaCount(tiles)).toBe(8);
    expect(new Set(socioNames(tiles)).size).toBe(4);

    const html = render(named(4));
    expect(clonesOf(html).length).toBe(0);
    expect(html).not.toContain("mural-animate");
    expect(html).not.toContain('class="mural-row"');
    expect(count(html, 'aria-label="Pessoa 0, Elite"')).toBe(1);
    expect(count(html, `href="${ADESAO}"`)).toBe(8);
  });

  it("limiar: 12 topos ficam estáticos (a regra não fecha com poucas vagas); 120 viram carrossel sem vagas", () => {
    expect(buildMosaic(named(12)).mode).toBe("static");
    const big = buildMosaic(named(120));
    expect(big.mode).toBe("carousel");
    expect(vagaCount(tilesOf(big))).toBe(0);
    expect(new Set(socioNames(tilesOf(big))).size).toBe(120);
  });

  it("carrossel: cada fileira cumpre a regra anti-repetição, no celular e no desktop, para 0 a 200 sócios", () => {
    const modes = new Set<string>();
    for (let n = 0; n <= 200; n++) {
      for (const cards of [named(n), mixed(n)]) {
        const layout = buildMosaic(cards);
        modes.add(layout.mode);
        if (layout.mode !== "carousel") continue;
        for (const row of layout.rows) {
          expect(rowSlack(row, "desktop"), `desktop n=${n}`).toBeGreaterThanOrEqual(MOSAIC_VISIBLE_MAX_PX);
          expect(rowSlack(row, "mobile"), `celular n=${n}`).toBeGreaterThanOrEqual(MOSAIC_PHONE_VISIBLE_MAX_PX);
        }
      }
    }
    // Os dois modos aparecem na faixa testada (o teste não passa só por um deles).
    expect([...modes].sort()).toEqual(["carousel", "static"]);
  });

  it("carrossel: nenhuma fileira usa mais vagas extras que o limite por fileira", () => {
    for (let n = 0; n <= 200; n++) {
      for (const cards of [named(n), mixed(n)]) {
        const layout = buildMosaic(cards);
        if (layout.mode !== "carousel") continue;
        for (const row of layout.rows) {
          expect(vagaCount(row), `n=${n}`).toBeLessThanOrEqual(MOSAIC_CAROUSEL_MAX_VACANCIES_PER_ROW);
        }
      }
    }
  });

  it("carrossel com poucos sócios de níveis diferentes: entram vagas só para cumprir a regra", () => {
    const layout = buildMosaic(mixed(26));
    expect(layout.mode).toBe("carousel");
    const vagas = vagaCount(tilesOf(layout));
    expect(vagas).toBeGreaterThan(0);
    expect(vagas).toBeLessThanOrEqual(MOSAIC_CAROUSEL_MAX_VACANCIES_PER_ROW * MOSAIC_ROWS);
  });

  it("carrossel (simulação do loop): nenhum sócio aparece 2x ao mesmo tempo, no celular e no desktop", () => {
    for (const cards of [named(40), mixed(26)]) {
      const layout = buildMosaic(cards);
      expect(layout.mode).toBe("carousel");
      for (const row of layout.rows) {
        const sets = mosaicRowSets(mosaicRowMinWidthPx(row, "mobile"));
        expect(sameTileTwiceOnScreen(minWidths(row, "mobile"), MOSAIC_PHONE_VISIBLE_MAX_PX, sets)).toBe(false);
        expect(sameTileTwiceOnScreen(minWidths(row, "desktop"), MOSAIC_VISIBLE_MAX_PX, sets)).toBe(false);
      }
    }
    // Controle: 10 tiles de 100 px numa área de 1200 px repetem (o teste detecta o erro).
    expect(sameTileTwiceOnScreen(Array.from({ length: 10 }, () => 100), 1200, 3)).toBe(true);
  });

  it("cada sócio aparece uma vez em qualquer quantidade (estático ou carrossel)", () => {
    for (const n of [1, 7, 12, 13, 23, 29, 30, 31, 44, 45, 46, 47, 95]) {
      const tiles = tilesOf(buildMosaic(named(n)));
      expect(socioNames(tiles).length, `n=${n}`).toBe(n);
      expect(new Set(socioNames(tiles)).size, `n=${n}`).toBe(n);
    }
  });

  it("o topo (nível 0) cai nas duas fileiras do carrossel: 8 topos e 40 sócios de entrada", () => {
    const list = [...named(8, { tier: 0, planName: "Elite" }), ...named(40, { tier: 1, planName: "Pleno" }).map((c, i) => ({ ...c, name: `Meio ${i}` }))];
    const layout = buildMosaic(list);
    expect(layout.mode).toBe("carousel");
    const rowsWithTop = layout.rows.filter((row) => row.some((t) => t.kind === "socio" && t.rank === "top"));
    expect(rowsWithTop.length).toBe(MOSAIC_ROWS);
  });

  it("é determinístico: a mesma entrada gera o mesmo layout (estático e carrossel)", () => {
    for (const list of [named(10, { tier: 0 }), mixed(120), named(3, { tier: 2 })]) {
      expect(buildMosaic(list)).toEqual(buildMosaic(list));
    }
  });
});

describe("tamanho por nível e aparência no mosaico", () => {
  it("topo, entrada e vaga têm o mesmo tamanho; o topo se destaca pela coroa/anel", () => {
    const list = [card({ name: "Bia", tier: 0 }), ...named(6, { tier: 2, planName: "Raiz" })];
    const tiles = tilesOf(buildMosaic(list));
    const sizes = new Set(tiles.map((t) => t.look.desktopPx));
    expect(sizes.size).toBe(1);
    expect(tiles.some((t) => t.kind === "socio" && t.rank === "top")).toBe(true);
  });
  it("as bolhas variam só em margem e deslocamento (tamanho fixo)", () => {
    const tiles = tilesOf(buildMosaic(named(30, { tier: 1, planName: "Pleno" })));
    expect(new Set(tiles.map((t) => t.look.desktopPx)).size).toBe(1);
    expect(new Set(tiles.map((t) => t.look.marginPx)).size).toBeGreaterThan(8);
    expect(new Set(tiles.map((t) => t.look.dyPx)).size).toBeGreaterThan(8);
  });
  it("o HTML leva o deslocamento e a margem de cada tile (valores dentro dos limites)", () => {
    const html = render(named(12, { tier: 0 }));
    const dys = [...html.matchAll(/--dy:(-?\d+)px/g)].map((m) => Number(m[1]));
    const mxs = [...html.matchAll(/--mx:(\d+)px/g)].map((m) => Number(m[1]));
    expect(dys.length).toBeGreaterThan(0);
    for (const dy of dys) expect(Math.abs(dy)).toBeLessThanOrEqual(WALL_DY_MAX_PX);
    for (const mx of mxs) {
      expect(mx).toBeGreaterThanOrEqual(WALL_MARGIN_MIN_PX);
      expect(mx).toBeLessThanOrEqual(WALL_MARGIN_MAX_PX);
    }
  });

  it("código do mural sem Math.random (a aparência é determinística, sem diferença entre servidor e cliente)", () => {
    const dir = path.resolve(__dirname);
    const src = readFileSync(path.join(dir, "WallCarousel.tsx"), "utf8");
    const tier = readFileSync(path.resolve(__dirname, "../../lib/membership/wall-tier.ts"), "utf8");
    expect(src).not.toMatch(/Math\.random/);
    expect(tier).not.toMatch(/Math\.random/);
  });
});

describe("primitivas do mosaico", () => {
  it("interleaveVacancies: mantém a ordem dos itens, põe o número exato de vagas e posições distintas", () => {
    const out = interleaveVacancies(["a", "b", "c", "d"], 3);
    expect(out.length).toBe(7);
    expect(out.filter((t) => t === null).length).toBe(3);
    expect(out.filter((t) => t !== null)).toEqual(["a", "b", "c", "d"]);
  });

  it("interleaveVacancies sem vagas devolve os itens na mesma ordem", () => {
    expect(interleaveVacancies([1, 2, 3], 0)).toEqual([1, 2, 3]);
  });

  it("splitMosaicRows: rodízio, sem perder nem repetir itens", () => {
    const rows = splitMosaicRows([1, 2, 3, 4, 5, 6, 7], 3);
    expect(rows).toEqual([
      [1, 4, 7],
      [2, 5],
      [3, 6],
    ]);
  });

  it("cada fileira tem cópias suficientes para cobrir a área visível, sem ponta", () => {
    for (const minWidth of [42, 60, 100, 300, 588, 1000, 1400]) {
      const sets = mosaicRowSets(minWidth);
      expect(sets).toBeGreaterThanOrEqual(3);
      // Um set anda de cada vez: (sets - 1) larguras de set precisam cobrir a área visível.
      expect((sets - 1) * minWidth).toBeGreaterThanOrEqual(MOSAIC_VISIBLE_MAX_PX);
    }
  });

  it("regra anti-repetição: a soma menos a maior bolha tem de passar da área visível", () => {
    expect(mosaicRuleHolds([])).toBe(false);
    const enough = Array.from({ length: 30 }, () => ({ desktop: 64, mobile: 51 }));
    expect(mosaicRuleHolds(enough)).toBe(true);
    const few = Array.from({ length: 10 }, () => ({ desktop: 64, mobile: 51 }));
    expect(mosaicRuleHolds(few)).toBe(false);
  });

  it("posição do balão: centralizado no tile e dentro da tela", () => {
    const mid = popoverPosition({ left: 500, right: 540, top: 300, bottom: 340 }, 1024);
    expect(mid.left).toBe(416);
    expect(mid.above).toBe(true);
    expect(mid.top).toBe(292);

    const leftEdge = popoverPosition({ left: 0, right: 20, top: 50, bottom: 70 }, 375);
    expect(leftEdge.left).toBe(8);
    expect(leftEdge.above).toBe(false);
    expect(leftEdge.top).toBe(78);

    const rightEdge = popoverPosition({ left: 360, right: 380, top: 500, bottom: 520 }, 375);
    expect(rightEdge.left).toBe(159);
  });
});

describe("geometria vertical: nada cortado, sem sobreposição entre linhas", () => {
  it("o padding cobre o deslocamento, a flutuação para cima e o brilho do topo", () => {
    expect(MOSAIC_PAD_PX).toBeGreaterThanOrEqual(WALL_DY_MAX_PX + WALL_BOB_MAX_PX + MOSAIC_GLOW_PX);
    // O brilho do topo é box-shadow 0 0 12px 2px: 12 px de desfoque e 2 px de espalhamento.
    expect(MOSAIC_GLOW_PX).toBeGreaterThanOrEqual(12 + 2);
  });

  it("o espaço entre linhas é o do pior caso (bolha de cima descendo, bolha de baixo subindo)", () => {
    expect(MOSAIC_LINE_GAP_PX).toBe(2 * WALL_DY_MAX_PX + WALL_BOB_MAX_PX);
    expect(MOSAIC_ROW_OVERLAP_PX).toBe(2 * MOSAIC_PAD_PX - MOSAIC_LINE_GAP_PX);
  });

  it("no pior caso, a bolha de baixo não encosta na de cima (com o nome embaixo)", () => {
    for (const maxBubble of [Math.round(WALL_TOP_SIZE.mobile * (1 + WALL_SCALE_SPREAD)), Math.round(WALL_TOP_SIZE.desktop * (1 + WALL_SCALE_SPREAD))]) {
      const content = maxBubble + MOSAIC_LABEL_ZONE_PX;
      const pitch = mosaicRowPitchPx(maxBubble);
      // Relativo ao topo da fileira de cima: a parte de baixo da bolha de cima (com o nome) e o topo
      // da bolha de baixo, com o deslocamento e a flutuação no pior caso.
      const bottomOfUpper = MOSAIC_PAD_PX + WALL_DY_MAX_PX + content;
      const topOfLower = pitch + MOSAIC_PAD_PX - WALL_DY_MAX_PX - WALL_BOB_MAX_PX;
      expect(topOfLower).toBeGreaterThanOrEqual(bottomOfUpper);
    }
  });

  it("carrossel: cada fileira tem o padding e a fileira de baixo é encaixada pela margem negativa", () => {
    const html = render(named(120));
    expect(count(html, `padding-block:${MOSAIC_PAD_PX}px`)).toBe(MOSAIC_ROWS);
    expect(count(html, `margin-top:-${MOSAIC_ROW_OVERLAP_PX}px`)).toBe(MOSAIC_ROWS - 1);
  });

  it("estático: o padding e o espaço entre linhas vão para o HTML", () => {
    const html = render(named(5));
    expect(count(html, `padding-block:${MOSAIC_PAD_PX}px`)).toBe(1);
    expect(count(html, `row-gap:${MOSAIC_LINE_GAP_PX}px`)).toBe(1);
    expect(count(html, 'class="mural-static"')).toBe(1);
  });
});

describe("renderização: fileiras, cópias e movimento", () => {
  it("carrossel: fileiras animadas (também no celular), com sentidos alternados e ritmos diferentes", () => {
    const html = render(named(120));
    expect(count(html, 'class="mural-row"')).toBe(MOSAIC_ROWS);
    expect(count(html, "mural-animate-fwd")).toBe(Math.ceil(MOSAIC_ROWS / 2));
    expect(count(html, "mural-animate-rev")).toBe(Math.floor(MOSAIC_ROWS / 2));
    const durations = [...html.matchAll(/animation-duration:([\d.]+)s/g)].map((m) => m[1]);
    expect(durations.length).toBe(MOSAIC_ROWS);
    expect(new Set(durations).size).toBe(MOSAIC_ROWS);
  });

  it("carrossel: cada fileira tem as cópias do loop (aria-hidden) conforme a largura dela", () => {
    const rows = buildMosaic(named(120)).rows;
    const expectedClones = rows.reduce((sum, row) => sum + (mosaicRowSets(mosaicRowMinWidthPx(row, "mobile")) - 1), 0);
    const html = render(named(120));
    expect(clonesOf(html).length).toBe(expectedClones);
  });

  it("carrossel: a lista real aparece uma vez; as cópias não têm foco, link nem botão", () => {
    const html = render(named(40));
    const visible = withoutClones(html);
    for (let i = 0; i < 40; i++) {
      expect(count(visible, `aria-label="Pessoa ${i}, Elite"`), `Pessoa ${i}`).toBe(1);
    }
    for (const clone of clonesOf(html)) {
      expect(clone).not.toMatch(/tabindex|<a |<button|href=/i);
    }
  });

  it("estático: sem cópias do loop e sem marquee; a lista real aparece uma vez", () => {
    const html = render(named(5));
    expect(clonesOf(html).length).toBe(0);
    expect(count(html, "mural-animate")).toBe(0);
    for (let i = 0; i < 5; i++) {
      expect(count(html, `aria-label="Pessoa ${i}, Elite"`), `Pessoa ${i}`).toBe(1);
    }
  });

  it("vagas são links reais para /socios/adesao, com texto acessível (estático com 5 sócios: 7 vagas)", () => {
    const html = render(named(5));
    expect(count(html, `href="${ADESAO}"`)).toBe(MOSAIC_STATIC_TARGET_TILES - 5);
    expect(count(html, `aria-label="${VAGA_LABEL}"`)).toBe(MOSAIC_STATIC_TARGET_TILES - 5);
    expect(count(html, "href=")).toBe(count(withoutClones(html), "href="));
  });

  it("sem vagas quando há sócios suficientes", () => {
    const html = render(named(120));
    expect(html).not.toContain(`href="${ADESAO}"`);
    expect(html).not.toContain("Seu lugar");
  });

  it("o botão de cada sócio começa fechado e sem balão no servidor", () => {
    const html = render(named(5));
    expect(count(withoutClones(html), 'aria-expanded="false"')).toBe(5);
    expect(html).not.toContain('role="tooltip"');
    expect(html).not.toContain("aria-describedby");
  });

  it("é determinístico: renderizar duas vezes gera o mesmo HTML", () => {
    const list = named(12, { tier: 1 });
    expect(render(list)).toBe(render(list));
  });
});

describe("hierarquia: anel e coroa do topo", () => {
  it("o topo tem coroa, anel de 3 px e brilho na cor do plano", () => {
    const html = render([card({ name: "Bia", tier: 0, cardColor: "#1F3A93", planName: "Elite" })]);
    expect(html).toContain("border-width:3px");
    expect(html).toContain("border-color:#1f3a93");
    expect(html).toContain("box-shadow:0 0 12px 2px #1f3a9399");
  });

  it("a coroa aparece na legenda e em cada tile do topo (real e cópias)", () => {
    const list = named(30);
    const rows = buildMosaic(list).rows;
    const html = render(list);
    // 1 na legenda (chip do topo) + 1 em cada tile real + os tiles de cada cópia.
    const copies = rows.reduce((sum, row) => sum + (mosaicRowSets(mosaicRowMinWidthPx(row, "mobile")) - 1) * row.length, 0);
    expect(count(html, "lucide-crown")).toBe(1 + list.length + copies);
  });

  it("entrada tem anel fino (1 px) e o brilho só existe no topo", () => {
    const html = render([card({ name: "Bia", tier: 0 }), card({ name: "Caio", tier: 2, planName: "Raiz", cardColor: "#64748b" })]);
    expect(html).toContain("border-width:1px");
    expect(html).toContain("box-shadow:0 0 12px 2px");
    expect(count(withoutClones(html), "box-shadow:0 0 12px 2px")).toBe(1);
  });

  it("sem cor no plano: paleta de reserva por nível (ouro no topo), nunca cinza", () => {
    const html = render([card({ name: "Bia", tier: 0, planName: "Elite", cardColor: null }), card({ name: "Caio", tier: 1, planName: "Pleno", cardColor: null })]);
    expect(html).toContain("#c9a227");
    expect(html).toContain("#cbd5e1");
    expect(html).not.toContain("bg-secondary");
  });

  it("legenda: planos do mais caro ao mais barato, com a contagem de sócios", () => {
    const html = render([card({ name: "Ana", planName: "Raiz", tier: 2 }), card({ name: "Bia", planName: "Elite", tier: 0 }), card({ name: "Caio", planName: "Elite", tier: 0 })]);
    const start = html.indexOf('aria-label="Planos do mural');
    const legend = html.slice(start, html.indexOf("</ul>", start));
    expect(legend.indexOf(">Elite<")).toBeLessThan(legend.indexOf(">Raiz<"));
    expect(legend).toContain("2 sócios");
    expect(legend).toContain("1 sócio");
  });
});

describe("cartão do tile: foto, iniciais e nome curto", () => {
  it("com foto válida: <img> decorativo (alt vazio), lazy, com tamanho", () => {
    const html = render([card({ name: "Maria S.", photoUrl: PHOTO })]);
    expect(html).toContain(`src="${PHOTO}"`);
    expect(html).toContain('alt=""');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('width="512"');
  });

  it("sem foto: iniciais na cor do plano (escondidas de leitor de tela)", () => {
    const html = render([card({ name: "Maria S.", photoUrl: null, cardColor: "#1F3A93" })]);
    expect(html).not.toContain("<img");
    expect(html).toContain(">MS<");
    expect(html).toMatch(/background:linear-gradient\(135deg, #1f3a93 0%/);
  });

  it("URL de foto que não é da entrega de sócio não vira <img> (cai nas iniciais)", () => {
    const html = render([
      card({ name: "Maria S.", photoUrl: "https://evil.test/x.png" }),
      card({ name: "Caio T.", photoUrl: `https://res.cloudinary.com/${CLOUD}/image/upload/w_9999/x` }),
    ]);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("evil.test");
    expect(html).toContain(">MS<");
    expect(html).toContain(">CT<");
  });

  it("cor inválida não chega ao CSS e cai na paleta de reserva", () => {
    const html = render([card({ cardColor: "red;background:url(https://evil.test/x)" })]);
    expect(html).not.toContain("evil.test");
    expect(html).not.toContain("background:url");
    expect(html).toContain("#c9a227");
  });

  it("nome e plano são escapados (nada de HTML cru na página)", () => {
    const html = render([card({ name: '<img src=x onerror="alert(1)">', planName: "<b>Elite</b>" })]);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<b>Elite</b>");
  });

  it("o rótulo do tile mostra só o primeiro nome", () => {
    const html = render([card({ name: "Maria Souza" })]);
    expect(withoutClones(html)).toMatch(/aria-hidden="true" class="block w-full truncate[^"]*">Maria<\/span>/);
  });
});

describe("balão: nome, plano e data (sem contato)", () => {
  it("mostra nome curto, plano e 'Sócio desde dd/mm/aaaa', como tooltip ligado ao botão", () => {
    const html = renderToStaticMarkup(
      createElement(WallBalloon, { id: "balao-1", card: card({ name: "Maria S.", planName: "Elite", since: "15/03/2026" }) })
    );
    expect(html).toContain('role="tooltip"');
    expect(html).toContain('id="balao-1"');
    expect(html).toContain(">Maria S.<");
    expect(html).toContain(">Elite<");
    expect(html).toContain("Sócio desde 15/03/2026");
    expect(html).not.toMatch(/\d{1,2}:\d{2}|@|cpf|whatsapp|telefone/i);
  });

  it("escapa nome e plano no balão", () => {
    const html = renderToStaticMarkup(
      createElement(WallBalloon, { id: "b", card: card({ name: "<script>x</script>", planName: "<b>E</b>" }) })
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>E</b>");
  });
});

describe("globals.css - mural: movimento, pausa e bordas", () => {
  const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");
  const mural = css.slice(css.indexOf("Mural dos Sócios"), css.indexOf("/* ─── Utilities"));

  it("define os keyframes das fileiras e da flutuação, e não há resto do carrossel antigo", () => {
    expect(css).toContain("@keyframes mural-fwd");
    expect(css).toContain("@keyframes mural-rev");
    expect(css).toContain("@keyframes mural-bob");
    expect(mural).not.toMatch(/mural-float|mural-shine|mural-stage|scroll-snap/);
  });

  it("cada bolha usa as variáveis do próprio tile (tamanho, posição, margem e flutuação)", () => {
    expect(mural).toMatch(/width:\s*var\(--tile-m/);
    expect(mural).toMatch(/@media \(min-width:\s*640px\)[^}]*\{\s*\.mural-tile\s*\{\s*width:\s*var\(--tile-d/);
    expect(mural).toMatch(/top:\s*var\(--dy/);
    expect(mural).toMatch(/margin-left:\s*var\(--mx/);
    expect(mural).toMatch(/animation:\s*mural-bob\s+var\(--bob-dur/);
  });

  it("pausa com o hover, com o foco na fileira e com um balão aberto (toque)", () => {
    expect(mural).toMatch(/\.mural-row:hover \.mural-animate/);
    expect(mural).toMatch(/\.mural-row:focus-within \.mural-animate/);
    expect(mural).toMatch(/\.mural-row:has\(\[aria-expanded="true"\]\) \.mural-animate[^}]*animation-play-state:\s*paused/);
  });

  it("sem movimento: grade estática com wrap, sem marquee, sem flutuação, sem cópias e com o espaço entre linhas", () => {
    const block = mural.slice(mural.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toMatch(/\.mural-animate\s*\{\s*animation:\s*none/);
    expect(block).toMatch(/\.mural-bob\s*\{\s*animation:\s*none/);
    expect(block).toMatch(/\.mural-clone\s*\{\s*display:\s*none/);
    expect(block).toMatch(/flex-wrap:\s*wrap/);
    expect(block).toMatch(new RegExp(`row-gap:\\s*${MOSAIC_LINE_GAP_PX}px`));
  });

  it("modo estático: grade com quebra de linha, centralizada", () => {
    expect(mural).toMatch(/\.mural-static\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(mural).toMatch(/\.mural-static\s*\{[^}]*justify-content:\s*center/);
  });

  it("fade nas bordas: o celular cobre a maior bolha do celular, e o desktop, a do desktop", () => {
    const fades = [...mural.matchAll(/--mural-fade:\s*([\d.]+)rem/g)].map((m) => Number(m[1]) * 16);
    expect(fades.length).toBe(2);
    const [phone, desktop] = fades;
    expect(phone).toBeGreaterThanOrEqual(Math.ceil(WALL_TOP_SIZE.mobile * (1 + WALL_SCALE_SPREAD)));
    expect(desktop).toBeGreaterThanOrEqual(Math.ceil(WALL_TOP_SIZE.desktop * (1 + WALL_SCALE_SPREAD)));
    expect(mural).toMatch(
      /mask-image:\s*linear-gradient\(to right, transparent, black var\(--mural-fade\), black calc\(100% - var\(--mural-fade\)\), transparent\)/
    );
  });

  it("cada fileira esconde o que passa da largura (sem rolagem horizontal da página)", () => {
    expect(mural).toMatch(/\.mural-row\s*\{[^}]*overflow:\s*hidden/);
    expect(mural).not.toMatch(/100vw/);
  });
});
