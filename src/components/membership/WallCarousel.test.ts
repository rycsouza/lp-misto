import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMosaicRows,
  interleaveVacancies,
  MOSAIC_DESKTOP_STEP_PX,
  MOSAIC_MIN_STEP_PX,
  MOSAIC_MIN_TILES,
  MOSAIC_ROW_LENGTH,
  MOSAIC_ROWS,
  MOSAIC_VISIBLE_CLASS,
  MOSAIC_VISIBLE_MAX_PX,
  mosaicRowSets,
  popoverPosition,
  splitMosaicRows,
  WallBalloon,
  WallCarousel,
  type MosaicTile,
} from "@/components/membership/WallCarousel";
import type { WallCard } from "@/lib/membership/wall";

const CLOUD = "misto-test";
const PHOTO = `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,g_face,w_512,h_512,q_auto,f_auto/clube-a/socios/fotos/abc123`;
/** Maior tela de celular (abaixo de sm = 640 px) menos as margens laterais de 16 px de cada lado. */
const PHONE_VISIBLE_MAX_PX = 639 - 2 * 16;
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

/** Sócios com nomes únicos ("Pessoa 0", "Pessoa 1"...). */
const named = (n: number, over: Partial<WallCard> = {}): WallCard[] =>
  Array.from({ length: n }, (_, i) => card({ name: `Pessoa ${i}`, ...over }));

const render = (list: WallCard[], extra: Partial<Parameters<typeof WallCarousel>[0]> = {}) =>
  renderToStaticMarkup(createElement(WallCarousel, { label: "Sócios de Clube A", cards: list, ...extra }));

/** Remove as cópias do loop (aria-hidden): o que sobra é o que o leitor de tela vê. */
const withoutClones = (html: string) => html.replace(/<ul aria-hidden="true"[^>]*>[\s\S]*?<\/ul>/g, "");
const clonesOf = (html: string) => html.match(/<ul aria-hidden="true"[^>]*>[\s\S]*?<\/ul>/g) ?? [];
const count = (html: string, needle: string) => html.split(needle).length - 1;
const socioNames = (tiles: MosaicTile[]) => tiles.flatMap((t) => (t.kind === "socio" ? [t.card.name] : []));

/**
 * Simula o marquee de UMA fileira: a faixa tem `sets` cópias da sequência e anda uma sequência
 * (len × step) em loop. Em cada deslocamento de 1 px, vê quais tiles caem na área visível
 * [0, visible] e devolve true se algum mesmo tile (mesma posição dentro da sequência) aparece 2x.
 */
function sameTileTwiceOnScreen(len: number, step: number, slot: number, visible: number, sets = mosaicRowSets(len)): boolean {
  const loop = len * step;
  for (let shift = 0; shift < loop; shift++) {
    const seen = new Set<number>();
    for (let k = 0; k < sets * len; k++) {
      const left = k * step - shift;
      if (left + slot > 0 && left < visible) {
        const id = k % len;
        if (seen.has(id)) return true;
        seen.add(id);
      }
    }
  }
  return false;
}

describe("mosaico: quantidade de tiles e vagas", () => {
  it("o mínimo é 30 tiles em 3 fileiras, de 10 tiles cada", () => {
    expect(MOSAIC_ROWS).toBe(3);
    expect(MOSAIC_ROW_LENGTH).toBe(13);
    expect(MOSAIC_MIN_TILES).toBe(39);
  });

  it("os passos exportados batem com as classes do slot (w-17 e sm:w-24) e com o gap de 4 px", () => {
    // Tailwind: 1 unidade de espaçamento = 0,25 rem = 4 px. w-17 = 68 px; sm:w-24 = 96 px.
    expect(MOSAIC_MIN_STEP_PX).toBe(17 * 4 + 4);
    expect(MOSAIC_DESKTOP_STEP_PX).toBe(24 * 4 + 4);
    const html = render(named(5));
    expect(html).toContain("w-17 sm:w-24");
  });

  it("a área visível é limitada a max-w-6xl (72 rem = 1152 px, largura dos planos) e a classe vai para o HTML", () => {
    expect(MOSAIC_VISIBLE_CLASS).toBe("max-w-6xl");
    expect(MOSAIC_VISIBLE_MAX_PX).toBe(72 * 16);
    const html = render(named(5));
    expect(html).toMatch(new RegExp(`<div role="region" aria-label="[^"]*" class="[^"]*${MOSAIC_VISIBLE_CLASS}[^"]*"`));
  });

  it("relação largura visível < sequência: a fileira (tiles × passo) é mais larga que a área visível", () => {
    // Celular: a sequência (13 × 72 = 936 px) passa da maior tela de celular (607 px de área).
    expect(MOSAIC_ROW_LENGTH * MOSAIC_MIN_STEP_PX).toBeGreaterThan(PHONE_VISIBLE_MAX_PX);
    // Desktop: a sequência (13 × 100 = 1300 px) passa da área visível máxima (1152 px).
    expect(MOSAIC_ROW_LENGTH * MOSAIC_DESKTOP_STEP_PX).toBeGreaterThan(MOSAIC_VISIBLE_MAX_PX);
  });

  it("a relação vale para as fileiras reais, com qualquer número de sócios (de 0 a 200)", () => {
    for (let n = 0; n <= 200; n += 1) {
      for (const row of buildMosaicRows(named(n))) {
        expect(row.length * MOSAIC_MIN_STEP_PX, `n=${n}`).toBeGreaterThan(PHONE_VISIBLE_MAX_PX);
        expect(row.length * MOSAIC_DESKTOP_STEP_PX, `n=${n}`).toBeGreaterThan(MOSAIC_VISIBLE_MAX_PX);
      }
    }
  });

  it("nenhum sócio aparece 2x na tela ao mesmo tempo, no celular e no desktop (simulação do loop)", () => {
    // Celular: tile 68 px, passo 72, área 607 px. Desktop: tile 96 px, passo 100, área 1152 px.
    expect(sameTileTwiceOnScreen(MOSAIC_ROW_LENGTH, MOSAIC_MIN_STEP_PX, 68, PHONE_VISIBLE_MAX_PX)).toBe(false);
    expect(sameTileTwiceOnScreen(MOSAIC_ROW_LENGTH, MOSAIC_DESKTOP_STEP_PX, 96, MOSAIC_VISIBLE_MAX_PX)).toBe(false);
    // Controle: sem o limite de largura, uma tela de 1200 px repetiria tiles (o teste detecta o erro).
    expect(sameTileTwiceOnScreen(MOSAIC_ROW_LENGTH, MOSAIC_DESKTOP_STEP_PX, 96, 1500)).toBe(true);
  });

  it("poucos sócios: completa com vagas até o mínimo, sem repetir nenhum sócio", () => {
    const rows = buildMosaicRows(named(5));
    const tiles = rows.flat();
    expect(rows.length).toBe(MOSAIC_ROWS);
    expect(tiles.length).toBe(MOSAIC_MIN_TILES);
    expect(tiles.filter((t) => t.kind === "vaga").length).toBe(MOSAIC_MIN_TILES - 5);
    const names = socioNames(tiles);
    expect(names.length).toBe(5);
    expect(new Set(names).size).toBe(5);
  });

  it("com 4 sócios, são 35 vagas (39 tiles no total)", () => {
    const tiles = buildMosaicRows(named(4)).flat();
    expect(tiles.length).toBe(39);
    expect(tiles.filter((t) => t.kind === "vaga").length).toBe(35);
  });

  it("sócios suficientes: nenhuma vaga, e cada sócio aparece uma vez", () => {
    const tiles = buildMosaicRows(named(120)).flat();
    expect(tiles.filter((t) => t.kind === "vaga").length).toBe(0);
    expect(new Set(socioNames(tiles)).size).toBe(120);
  });

  it("uma fileira nunca tem sócio demais para as vagas: a conta fecha no mínimo até o limite", () => {
    for (const n of [1, 7, 8, 9, 23, 29, 30, 31, 47, 95]) {
      const tiles = buildMosaicRows(named(n)).flat();
      expect(tiles.length, `n=${n}`).toBe(Math.max(MOSAIC_MIN_TILES, n));
      expect(socioNames(tiles).length, `n=${n}`).toBe(n);
    }
  });

  it("o topo (nível 0) cai em fileiras diferentes: com 8 topos e 3 fileiras, todas recebem topo", () => {
    const list = [...named(8, { tier: 0, planName: "Elite" }), ...named(16, { tier: 1, planName: "Pleno" }).map((c, i) => ({ ...c, name: `Meio ${i}` }))];
    const rows = buildMosaicRows(list);
    const rowsWithTop = rows.filter((row) => row.some((t) => t.kind === "socio" && t.rank === "top"));
    expect(rowsWithTop.length).toBe(MOSAIC_ROWS);
  });

  it("é determinístico: a mesma entrada gera a mesma ordem de tiles", () => {
    const list = [...named(10, { tier: 0 }), ...named(3, { tier: 2 })];
    const a = buildMosaicRows(list).map((row) => row.map((t) => (t.kind === "socio" ? t.card.name : "_")));
    const b = buildMosaicRows(list).map((row) => row.map((t) => (t.kind === "socio" ? t.card.name : "_")));
    expect(a).toEqual(b);
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
    for (let k = 1; k <= 12; k++) {
      const sets = mosaicRowSets(k);
      expect(sets).toBeGreaterThanOrEqual(3);
      // Um set anda de cada vez: (sets - 1) larguras de set precisam cobrir a área visível.
      expect((sets - 1) * k * MOSAIC_MIN_STEP_PX).toBeGreaterThanOrEqual(MOSAIC_VISIBLE_MAX_PX);
    }
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

describe("renderização: fileiras, cópias e movimento", () => {
  it("todas as fileiras animadas (também no celular), com sentidos alternados e ritmos diferentes", () => {
    const html = render(named(5));
    expect(count(html, 'class="mural-row"')).toBe(MOSAIC_ROWS);
    expect(count(html, "mural-animate-fwd")).toBe(Math.ceil(MOSAIC_ROWS / 2));
    expect(count(html, "mural-animate-rev")).toBe(Math.floor(MOSAIC_ROWS / 2));
    const durations = [...html.matchAll(/animation-duration:([\d.]+)s/g)].map((m) => m[1]);
    expect(durations.length).toBe(MOSAIC_ROWS);
    expect(new Set(durations).size).toBe(MOSAIC_ROWS);
  });

  it("cada fileira tem as cópias do loop (aria-hidden) conforme a largura dela", () => {
    const rows = buildMosaicRows(named(5));
    const expectedClones = rows.reduce((sum, row) => sum + (mosaicRowSets(row.length) - 1), 0);
    const html = render(named(5));
    expect(clonesOf(html).length).toBe(expectedClones);
  });

  it("a lista real aparece uma vez; as cópias não têm foco, link nem botão", () => {
    const html = render(named(5));
    const visible = withoutClones(html);
    for (let i = 0; i < 5; i++) {
      expect(count(visible, `aria-label="Pessoa ${i}, Elite"`), `Pessoa ${i}`).toBe(1);
    }
    for (const clone of clonesOf(html)) {
      expect(clone).not.toMatch(/tabindex|<a |<button|href=/i);
    }
  });

  it("vagas são links reais para /socios/adesao, com texto acessível, só na lista real", () => {
    const html = render(named(5));
    const visible = withoutClones(html);
    expect(count(visible, `href="${ADESAO}"`)).toBe(MOSAIC_MIN_TILES - 5);
    expect(count(visible, `aria-label="${VAGA_LABEL}"`)).toBe(MOSAIC_MIN_TILES - 5);
    expect(count(html, "href=")).toBe(count(visible, "href="));
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
    const list = [card({ name: "Bia", tier: 0 }), ...named(4, { tier: 2, planName: "Raiz" })];
    const rows = buildMosaicRows(list);
    const rowWithTop = rows.find((row) => row.some((t) => t.kind === "socio" && t.rank === "top"));
    expect(rowWithTop).toBeDefined();
    const html = render(list);
    // 1 na legenda (chip do topo) + 1 tile real + as cópias da mesma fileira.
    expect(count(html, "lucide-crown")).toBe(1 + mosaicRowSets(rowWithTop!.length));
  });

  it("entrada tem anel fino (1 px) e não tem coroa", () => {
    const html = render([card({ name: "Bia", tier: 0 }), card({ name: "Caio", tier: 2, planName: "Raiz", cardColor: "#64748b" })]);
    expect(html).toContain("border-width:1px");
    // O brilho só existe no topo (Bia), então a entrada (Caio) não recebe o brilho.
    expect(html).toContain("box-shadow:0 0 12px 2px");
    expect(count(html, "border-width:1px")).toBeGreaterThan(0);
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

describe("globals.css - mural: movimento e pausa", () => {
  const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");
  const mural = css.slice(css.indexOf("Mural dos Sócios"), css.indexOf("/* ─── Utilities"));

  it("define os keyframes das fileiras e não há resto do carrossel antigo", () => {
    expect(css).toContain("@keyframes mural-fwd");
    expect(css).toContain("@keyframes mural-rev");
    expect(mural).not.toMatch(/mural-float|mural-shine|mural-stage|scroll-snap/);
  });

  it("pausa com o hover, com o foco na fileira e com um balão aberto (toque)", () => {
    expect(mural).toMatch(/\.mural-row:hover \.mural-animate/);
    expect(mural).toMatch(/\.mural-row:focus-within \.mural-animate/);
    expect(mural).toMatch(/\.mural-row:has\(\[aria-expanded="true"\]\) \.mural-animate[^}]*animation-play-state:\s*paused/);
  });

  it("sem movimento: grade estática com wrap, sem animação e sem cópias", () => {
    const block = mural.slice(mural.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toMatch(/\.mural-animate\s*\{\s*animation:\s*none/);
    expect(block).toMatch(/\.mural-clone\s*\{\s*display:\s*none/);
    expect(block).toMatch(/flex-wrap:\s*wrap/);
  });

  it("cada fileira esconde o que passa da largura (sem rolagem horizontal da página)", () => {
    expect(mural).toMatch(/\.mural-row\s*\{[^}]*overflow:\s*hidden/);
    expect(mural).not.toMatch(/100vw/);
  });
});

describe("cópias do loop também mostram o balão (hover/toque)", () => {
  it("cópia tem gatilho decorativo: aria-hidden, sem foco e sem botão, com cursor de clique", () => {
    const html = render(named(5));
    const clones = html.match(/<ul aria-hidden="true"[^>]*>[\s\S]*?<\/ul>/g) ?? [];
    expect(clones.length).toBeGreaterThan(0);
    for (const clone of clones) {
      expect(clone).not.toMatch(/tabindex|<button|href=/i);
      expect(clone).toContain("cursor-pointer");
    }
  });
});
