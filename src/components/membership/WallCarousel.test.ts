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
  it("sem faixa abaixo do mínimo; 2 faixas de 6 a 11; 3 a partir de 12", () => {
    expect(wallRowCount(1)).toBe(1);
    expect(wallMarqueePlan(WALL_MARQUEE_MIN - 1).animate).toBe(false);
    expect(wallMarqueePlan(WALL_MARQUEE_MIN).animate).toBe(true);
    expect(wallMarqueePlan(6).rows).toBe(2);
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

describe("sem faixa (poucos sócios)", () => {
  it("cartões centralizados em grade, sem região rolável nem animação de faixa", () => {
    const html = render(cards(3));
    expect(html).toContain("flex-wrap");
    expect(html).not.toContain("mural-row");
    expect(html).not.toContain("mural-animate");
    expect(html).not.toContain('<ul aria-hidden="true"');
    expect(count(html, "Sócio A")).toBe(1);
    expect(html).toContain("Sócio desde 15/03/2026");
  });

  it("a foto continua flutuando (o movimento é desligado pelo reduced-motion no CSS)", () => {
    expect(render(cards(2))).toContain("mural-float");
  });
});

describe("faixas animadas", () => {
  it("6 sócios viram 2 regiões focáveis, com nome acessível por faixa", () => {
    const html = render(cards(6));
    expect(count(html, 'role="region"')).toBe(2);
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Sócios de Clube A, faixa 1 de 2"');
    expect(html).toContain('aria-label="Sócios de Clube A, faixa 2 de 2"');
  });

  it("a lista real de cada faixa é lida uma vez; cópias são aria-hidden e sem foco", () => {
    const html = render(cards(6));
    const visible = withoutClones(html);
    for (let i = 0; i < 6; i++) {
      const name = `Sócio ${String.fromCharCode(65 + i)}`;
      expect(count(visible, `>${name}<`), name).toBe(1);
    }
    const clones = html.match(/<ul aria-hidden="true"[^>]*>[\s\S]*?<\/ul>/g) ?? [];
    expect(clones.length).toBe(2 * (wallRowSets(3) - 1));
    for (const clone of clones) {
      expect(clone).not.toMatch(/tabindex|<a |<button/i);
    }
  });

  it("a velocidade vem da quantidade de cartões de cada faixa", () => {
    const html = render(cards(6));
    // 2 faixas de 3 cartões: 3 x 4,5 s.
    expect(count(html, "animation-duration:13.5s")).toBe(2);
    expect(html).toContain(`--mural-sets:${wallRowSets(3)}`);
  });

  it("faixas alternam o sentido", () => {
    const html = render(cards(6));
    expect(count(html, "mural-animate-fwd")).toBe(1);
    expect(count(html, "mural-animate-rev")).toBe(1);
  });

  it("12 sócios viram 3 faixas", () => {
    expect(count(render(cards(12)), 'role="region"')).toBe(3);
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

  it("sem foto: avatar com as iniciais (escondido de leitor de tela, o nome já está no cartão)", () => {
    const html = render([card({ name: "Maria S.", photoUrl: null, cardColor: "#1F3A93" })]);
    expect(html).not.toContain("<img");
    expect(html).toContain(">MS<");
    expect(html).toMatch(/aria-hidden="true"[^>]*>MS</);
    expect(html).toContain("background-color:#1f3a93");
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
    expect(html).toContain("background-color:#1f3a93");
  });

  it("cor inválida não chega ao CSS e a etiqueta fica neutra", () => {
    const html = render([card({ cardColor: "red;background:url(https://evil.test/x)" })]);
    expect(html).not.toContain("evil.test");
    expect(html).not.toContain("background:url");
    expect(html).not.toContain("background-color:red");
    expect(html).toContain("bg-secondary");
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

  it("inclinação leve por cartão, pelo índice (sem aleatoriedade no servidor)", () => {
    const html = render(cards(3));
    expect(html).toContain("rotate:-2deg");
    expect(html).toContain("rotate:1.5deg");
    expect(render(cards(3))).toBe(html);
  });
});

describe("globals.css - movimento e flutuar", () => {
  const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

  it("define o keyframe e a classe de flutuar", () => {
    expect(css).toContain("@keyframes mural-float");
    expect(css).toMatch(/\.mural-float\s*\{[^}]*animation:\s*mural-float/);
  });

  it("sem movimento: o flutuar também é desligado", () => {
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)", css.indexOf("Mural dos Sócios")));
    expect(block).toMatch(/\.mural-float\s*\{\s*animation:\s*none/);
    expect(block).toMatch(/\.mural-animate\s*\{\s*animation:\s*none/);
    expect(block).toMatch(/\.mural-clone\s*\{\s*display:\s*none/);
  });

  it("o hover/foco pausa também o flutuar", () => {
    expect(css).toMatch(/\.mural-row:hover \.mural-float/);
  });
});
