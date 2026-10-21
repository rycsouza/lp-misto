import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  splitWallRows,
  WallCarousel,
  wallMarqueePlan,
  wallRowCount,
  wallRowSets,
  WALL_MARQUEE_MIN,
  WALL_MARQUEE_SETS,
} from "@/components/membership/WallCarousel";
import type { WallCard } from "@/lib/membership/wall";

const CLOUD = "misto-test";
const PHOTO = `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,g_face,w_512,h_512,q_auto,f_auto/clube-a/socios/fotos/abc123`;
const CARD_STEP_PX = 156;
const VIEWPORT_MAX_PX = 1440;

const card = (over: Partial<WallCard> = {}): WallCard => ({
  name: "Ana",
  since: "15/03/2026",
  planName: "Elite",
  cardColor: null,
  photoUrl: null,
  tier: 0,
  ...over,
});

const cards = (n: number, over: Partial<WallCard> = {}): WallCard[] =>
  Array.from({ length: n }, (_, i) => card({ name: `Sócio ${String.fromCharCode(65 + i)}`, ...over }));

const render = (list: WallCard[], extra: Partial<Parameters<typeof WallCarousel>[0]> = {}) =>
  renderToStaticMarkup(createElement(WallCarousel, { label: "Sócios de Clube A", cards: list, ...extra }));

/** Remove as cópias de preenchimento (aria-hidden): o que sobra é o que o leitor de tela vê. */
const withoutClones = (html: string) => html.replace(/<ul aria-hidden="true"[^>]*>[\s\S]*?<\/ul>/g, "");
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("faixas: quantidade e distribuição", () => {
  it("sem faixa abaixo de 10 sócios; 2 faixas de 10 a 11; 3 a partir de 12", () => {
    expect(WALL_MARQUEE_MIN).toBe(10);
    expect(wallRowCount(1)).toBe(1);
    expect(wallMarqueePlan(WALL_MARQUEE_MIN - 1).animate).toBe(false);
    expect(wallMarqueePlan(WALL_MARQUEE_MIN).animate).toBe(true);
    expect(wallMarqueePlan(10).rows).toBe(2);
    expect(wallMarqueePlan(11).rows).toBe(2);
    expect(wallMarqueePlan(12).rows).toBe(3);
  });

  it("distribui em rodízio: cada sócio cai em UMA faixa só", () => {
    const rows = splitWallRows(["a", "b", "c", "d", "e", "f", "g"], 3);
    expect(rows.map((r) => r.length)).toEqual([3, 2, 2]);
    expect(rows.flat().sort()).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
  });

  it("cada faixa tem cópias suficientes para cobrir a tela inteira, sem ponta visível", () => {
    for (let k = 1; k <= 12; k++) {
      const sets = wallRowSets(k);
      expect(sets).toBeGreaterThanOrEqual(WALL_MARQUEE_SETS);
      // Um set anda de cada vez: (sets - 1) larguras de set precisam cobrir a tela.
      expect((sets - 1) * k * CARD_STEP_PX).toBeGreaterThanOrEqual(VIEWPORT_MAX_PX);
    }
  });
});

describe("palco (poucos sócios, sem faixa animada)", () => {
  it("sem região animada: cartões em fileira centralizada, sem movimento de faixa", () => {
    const html = render(cards(3));
    expect(html).toContain('class="mural-stage"');
    expect(html).not.toContain("mural-row");
    expect(html).not.toContain("mural-animate");
    expect(html).not.toContain("mural-clone");
    expect(html).not.toContain('<ul aria-hidden="true"');
    expect(count(html, "Sócio A")).toBe(1);
    expect(html).toContain("Sócio desde 15/03/2026");
  });

  it("o topo vem numa lista própria, antes dos demais (destaque no centro)", () => {
    const html = render([
      card({ name: "Ana", tier: 1, planName: "Pleno" }),
      card({ name: "Bia", tier: 0, planName: "Elite" }),
      card({ name: "Caio", tier: 1, planName: "Pleno" }),
    ]);
    const top = html.indexOf('class="mural-stage-top"');
    const rest = html.indexOf('class="mural-stage-rest"');
    expect(top).toBeGreaterThan(-1);
    expect(rest).toBeGreaterThan(top);
    const topBlock = html.slice(top, rest);
    expect(topBlock).toContain(">Bia<");
    expect(topBlock).not.toContain(">Ana<");
    expect(html.slice(rest)).toContain(">Ana<");
  });

  it("sem topo distinto (um plano só): todos ficam no destaque, sem lista de resto", () => {
    const html = render(cards(2));
    expect(html).toContain('class="mural-stage-top"');
    expect(html).not.toContain('class="mural-stage-rest"');
  });

  it("a foto continua flutuando (o movimento é desligado pelo reduced-motion no CSS)", () => {
    expect(render(cards(2))).toContain("mural-float");
  });
});

describe("hierarquia visual por nível", () => {
  it("o topo tem coroa, anel e brilho na cor do plano", () => {
    const html = render([card({ name: "Bia", tier: 0, cardColor: "#1F3A93", planName: "Elite" })]);
    expect(html).toContain("lucide-crown");
    expect(html).toContain("mural-shine");
    expect(html).toContain("0 0 0 2px #1f3a93");
    expect(html).toContain("border-color:#1f3a93");
  });

  it("entrada (nível mais baixo) não tem coroa nem brilho", () => {
    const html = render([
      card({ name: "Bia", tier: 0, planName: "Elite", cardColor: "#1f3a93" }),
      card({ name: "Caio", tier: 1, planName: "Raiz", cardColor: "#64748b" }),
    ]);
    // Só o cartão do topo leva coroa e brilho (a legenda também mostra coroa só no topo).
    expect(count(html, "mural-shine")).toBe(1);
    expect(count(html, "lucide-crown")).toBe(2);
  });

  it("sem cor no plano: paleta de reserva por nível (ouro no topo, prata abaixo), nunca cinza", () => {
    const html = render([
      card({ name: "Bia", tier: 0, planName: "Elite", cardColor: null }),
      card({ name: "Caio", tier: 1, planName: "Pleno", cardColor: null }),
    ]);
    expect(html).toContain("#c9a227");
    expect(html).toContain("#cbd5e1");
    expect(html).not.toContain("bg-secondary");
  });

  it("legenda: planos do mais caro ao mais barato, com a contagem de sócios", () => {
    const html = render([
      card({ name: "Ana", planName: "Raiz", tier: 2 }),
      card({ name: "Bia", planName: "Elite", tier: 0 }),
      card({ name: "Caio", planName: "Elite", tier: 0 }),
    ]);
    const start = html.indexOf('aria-label="Planos do mural');
    const legend = html.slice(start, html.indexOf("</ul>", start));
    expect(legend.indexOf(">Elite<")).toBeLessThan(legend.indexOf(">Raiz<"));
    expect(legend).toContain("2 sócios");
    expect(legend).toContain("1 sócio");
  });

  it("inclinação só nos cartões fora do topo; o topo fica reto", () => {
    const html = render([
      card({ name: "A", tier: 0 }),
      card({ name: "B", tier: 1 }),
      card({ name: "C", tier: 2 }),
      card({ name: "D", tier: 2 }),
    ]);
    expect(html).toContain("rotate:0deg");
    expect(html).toContain("rotate:1.5deg");
    expect(html).toContain("rotate:-1deg");
    expect(html).toContain("rotate:2deg");
    expect(render([card({ name: "A", tier: 0 }), card({ name: "B", tier: 1 })])).toBe(
      render([card({ name: "A", tier: 0 }), card({ name: "B", tier: 1 })])
    );
  });
});

describe("faixas animadas (a partir de 10 sócios)", () => {
  it("10 sócios viram 2 regiões focáveis, com nome acessível por faixa", () => {
    const html = render(cards(10));
    expect(count(html, 'role="region"')).toBe(2);
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Sócios de Clube A, faixa 1 de 2"');
    expect(html).toContain('aria-label="Sócios de Clube A, faixa 2 de 2"');
  });

  it("a lista real de cada faixa é lida uma vez; cópias são aria-hidden e sem foco", () => {
    const html = render(cards(10));
    const visible = withoutClones(html);
    for (let i = 0; i < 10; i++) {
      const name = `Sócio ${String.fromCharCode(65 + i)}`;
      expect(count(visible, `>${name}<`), name).toBe(1);
    }
    const clones = html.match(/<ul aria-hidden="true"[^>]*>[\s\S]*?<\/ul>/g) ?? [];
    expect(clones.length).toBe(2 * (wallRowSets(5) - 1));
    for (const clone of clones) {
      expect(clone).not.toMatch(/tabindex|<a |<button/i);
    }
  });

  it("a velocidade vem da quantidade de cartões de cada faixa", () => {
    const html = render(cards(10));
    // 2 faixas de 5 cartões: 5 x 4,5 s.
    expect(count(html, "animation-duration:22.5s")).toBe(2);
    expect(html).toContain(`--mural-sets:${wallRowSets(5)}`);
  });

  it("faixas alternam o sentido", () => {
    const html = render(cards(10));
    expect(count(html, "mural-animate-fwd")).toBe(1);
    expect(count(html, "mural-animate-rev")).toBe(1);
  });

  it("12 sócios viram 3 faixas", () => {
    expect(count(render(cards(12)), 'role="region"')).toBe(3);
  });

  it("dentro da faixa, o topo entra antes da entrada (a lista vem ordenada por nível)", () => {
    const html = render([
      ...["R0", "R1", "R2", "R3"].map((name) => card({ name, tier: 2, planName: "Raiz" })),
      ...["P4", "P5", "P6"].map((name) => card({ name, tier: 1, planName: "Pleno" })),
      ...["E7", "E8", "E9"].map((name) => card({ name, tier: 0, planName: "Elite" })),
    ]);
    // Ordem por nível: E7, E8, E9, P4..., R0... Em rodízio, a faixa 1 recebe E7, E9, P5, R0, R2.
    const firstRow = html.slice(html.indexOf('aria-label="Sócios de Clube A, faixa 1'));
    expect(firstRow.indexOf(">E7<")).toBeLessThan(firstRow.indexOf(">P5<"));
    expect(firstRow.indexOf(">P5<")).toBeLessThan(firstRow.indexOf(">R0<"));
  });
});

describe("cartão: foto, iniciais e etiqueta do plano", () => {
  it("com foto válida: <img> decorativo (alt vazio, o nome já aparece ao lado), lazy e com tamanho", () => {
    const html = render([card({ name: "Maria S.", photoUrl: PHOTO })]);
    expect(html).toContain(`src="${PHOTO}"`);
    expect(html).toContain('alt=""');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('width="512"');
    expect(html).toContain('height="512"');
  });

  it("sem foto: avatar com as iniciais na cor do plano (escondido de leitor de tela)", () => {
    const html = render([card({ name: "Maria S.", photoUrl: null, cardColor: "#1F3A93" })]);
    expect(html).not.toContain("<img");
    expect(html).toContain(">MS<");
    expect(html).toMatch(/aria-hidden="true"[^>]*>MS</);
    expect(html).toMatch(/background:linear-gradient\(135deg, #1f3a93 0%/);
  });

  it("sem foto e sem cor: iniciais na paleta de reserva, nunca cinza", () => {
    const html = render([card({ name: "Maria S.", photoUrl: null, cardColor: null })]);
    expect(html).toMatch(/background:linear-gradient\(135deg, #c9a227 0%/);
    expect(html).not.toContain("bg-muted text-muted-foreground");
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

  it("mostra a etiqueta com o nome do plano, na cor validada do plano", () => {
    const html = render([card({ planName: "Elite", cardColor: "#1F3A93" })]);
    expect(html).toContain(">Elite<");
    expect(html).toContain("#1f3a93");
  });

  it("cor inválida não chega ao CSS e cai na paleta de reserva", () => {
    const html = render([card({ cardColor: "red;background:url(https://evil.test/x)" })]);
    expect(html).not.toContain("evil.test");
    expect(html).not.toContain("background:url");
    expect(html).not.toContain("background-color:red");
    expect(html).toContain("#c9a227");
    expect(html).not.toContain("bg-secondary");
  });

  it("nome e plano são escapados (nada de HTML cru na página)", () => {
    const html = render([card({ name: '<img src=x onerror="alert(1)">', planName: "<b>Elite</b>" })]);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<b>Elite</b>");
  });

  it("cada cartão mostra só nome, plano e 'Sócio desde dd/mm/aaaa' (sem hora ou contato)", () => {
    const html = render([card({ name: "Ana", since: "15/03/2026" })]);
    expect(html).toContain("Sócio desde 15/03/2026");
    expect(count(html, "/2026")).toBe(1);
    expect(html).not.toMatch(/\d{1,2}:\d{2}|T\d{2}:/);
    expect(html).not.toMatch(/@|cpf|whatsapp|telefone/i);
  });
});

describe("globals.css - mural: movimento, palco e celular", () => {
  const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");
  const mural = css.slice(css.indexOf("Mural dos Sócios"), css.indexOf("/* ─── Utilities"));
  const mobile = mural.slice(mural.indexOf("@media (max-width: 39.9375rem)"));

  it("define o keyframe e a classe de flutuar", () => {
    expect(css).toContain("@keyframes mural-float");
    expect(css).toMatch(/\.mural-float\s*\{[^}]*animation:\s*mural-float/);
  });

  it("sem movimento: o flutuar e o brilho do topo também são desligados", () => {
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)", css.indexOf("Mural dos Sócios")));
    expect(block).toMatch(/\.mural-float\s*\{\s*animation:\s*none/);
    expect(block).toMatch(/\.mural-animate\s*\{\s*animation:\s*none/);
    expect(block).toMatch(/\.mural-shine\s*\{\s*animation:\s*none/);
    expect(block).toMatch(/\.mural-clone\s*\{\s*display:\s*none/);
  });

  it("o hover/foco pausa também o flutuar (faixa e palco)", () => {
    expect(css).toMatch(/\.mural-row:hover \.mural-float/);
    expect(css).toMatch(/\.mural-stage:hover \.mural-float/);
  });

  it("o brilho do topo existe e anda pela animação de brilho", () => {
    expect(css).toContain("@keyframes mural-shine");
    expect(css).toMatch(/\.mural-shine\s*\{[^}]*animation:\s*mural-shine/);
  });

  it("celular: faixas e palco viram fileiras com encaixe por cartão (scroll-snap)", () => {
    expect(mobile).toMatch(/scroll-snap-type:\s*x mandatory/);
    expect(mobile).toMatch(/overflow-x:\s*auto/);
    expect(mobile).toMatch(/overscroll-behavior-x:\s*contain/);
    expect(mobile).toMatch(/scroll-snap-align:\s*center/);
    expect(mobile).toMatch(/\.mural-animate[\s,{][^}]*animation:\s*none/);
    expect(mobile).toMatch(/\.mural-clone\s*\{\s*display:\s*none/);
  });

  it("celular: sem largura de tela forçada, para a página não rolar na horizontal", () => {
    expect(mural).not.toMatch(/100vw/);
  });
});
