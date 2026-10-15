import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WallCarousel, wallMarqueePlan, WALL_MARQUEE_MIN, WALL_MARQUEE_SETS } from "@/components/membership/WallCarousel";
import type { WallEntry } from "@/lib/membership/wall";

const entries = (n: number): WallEntry[] =>
  Array.from({ length: n }, (_, i) => ({ name: `Sócio ${String.fromCharCode(65 + i)}`, since: "03/2026" }));

const render = (list: WallEntry[], extra: Partial<Parameters<typeof WallCarousel>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(WallCarousel, {
      label: "Sócios do plano Elite",
      entries: list,
      cardColor: null,
      ...extra,
    })
  );

/** Remove as cópias de preenchimento (aria-hidden) para contar só o que o leitor de tela vê. */
const withoutClones = (html: string) => html.replace(/<ul aria-hidden="true"[^>]*>[\s\S]*?<\/ul>/g, "");
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("wallMarqueePlan", () => {
  it("não anima com poucos nomes", () => {
    for (let n = 0; n < WALL_MARQUEE_MIN; n++) {
      expect(wallMarqueePlan(n).animate).toBe(false);
    }
  });

  it("anima a partir do mínimo, com velocidade proporcional à quantidade de cards", () => {
    expect(wallMarqueePlan(WALL_MARQUEE_MIN).animate).toBe(true);
    const six = wallMarqueePlan(6).durationSec;
    const twelve = wallMarqueePlan(12).durationSec;
    expect(twelve).toBeCloseTo(six * 2);
    expect(six).toBeGreaterThan(0);
  });
});

describe("WallCarousel - poucos nomes (sem animação)", () => {
  it("mostra os cards centralizados, com nome e 'Sócio desde', sem faixa animada", () => {
    const html = render(entries(3));
    expect(html).not.toContain("mural-row");
    expect(html).not.toContain("mural-animate");
    expect(html).not.toContain("animation-duration");
    expect(html).not.toContain("aria-hidden");
    expect(html).toContain("justify-center");
    expect(html).toContain("Sócio A");
    expect(html).toContain("Sócio desde 03/2026");
    expect(count(html, "Sócio A")).toBe(1);
  });

  it("não expõe nada além de nome e mês/ano", () => {
    const html = render([{ name: "Ana", since: "03/2026" }]);
    expect(html).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(html).not.toMatch(/@|cpf|whatsapp/i);
  });
});

describe("WallCarousel - faixa animada", () => {
  it("duplica a sequência em sets, com a lista real lida uma única vez", () => {
    const html = render(entries(6));
    expect(html).toContain("mural-row");
    expect(html).toContain("mural-animate-fwd");
    expect(html).toContain(`--mural-sets:${WALL_MARQUEE_SETS}`);
    expect(count(html, "mural-clone")).toBe(WALL_MARQUEE_SETS - 1);
    expect(count(html, "Sócio A")).toBe(WALL_MARQUEE_SETS);
    expect(count(withoutClones(html), "Sócio A")).toBe(1);
    expect(count(withoutClones(html), "Sócio F")).toBe(1);
  });

  it("cópias do loop são aria-hidden e não têm foco", () => {
    const html = render(entries(6));
    const clones = html.match(/<ul aria-hidden="true"[^>]*>[\s\S]*?<\/ul>/g) ?? [];
    expect(clones).toHaveLength(WALL_MARQUEE_SETS - 1);
    for (const clone of clones) {
      expect(clone).not.toMatch(/tabindex|<a |<button/i);
    }
  });

  it("a região é focável (pausa o movimento) e tem nome acessível", () => {
    const html = render(entries(6));
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Sócios do plano Elite"');
  });

  it("a velocidade vem da quantidade de cards", () => {
    const html = render(entries(6));
    expect(html).toContain(`animation-duration:${wallMarqueePlan(6).durationSec}s`);
  });

  it("alterna o sentido quando reverse", () => {
    expect(render(entries(6), { reverse: true })).toContain("mural-animate-rev");
    expect(render(entries(6), { reverse: true })).not.toContain("mural-animate-fwd");
  });
});

describe("WallCarousel - segurança do conteúdo", () => {
  it("escapa o nome (nada de HTML cru na página)", () => {
    const html = render([{ name: '<img src=x onerror="alert(1)">', since: "03/2026" }]);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("aplica só cor de plano em hex válido (lowercase); valor malicioso não chega ao CSS", () => {
    const ok = render(entries(3), { cardColor: "#1F3A93" });
    expect(ok).toContain("background-color:#1f3a93");

    const bad = render(entries(3), { cardColor: "red;background:url(https://evil.test/x)" });
    expect(bad).not.toContain("evil.test");
    expect(bad).not.toContain("background-color:red");
    expect(bad).not.toContain("background:url");
  });

  it("sem cor válida não renderiza a barra de cor", () => {
    const html = render(entries(3), { cardColor: null });
    expect(html).not.toContain("background-color");
  });
});

describe("globals.css - movimento reduzido e keyframes", () => {
  const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

  it("sem movimento: a faixa vira rolável e as cópias somem", () => {
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)", css.indexOf("Mural dos Sócios")));
    expect(block).toContain(".mural-animate");
    expect(block).toMatch(/animation:\s*none/);
    expect(block).toMatch(/\.mural-clone\s*\{\s*display:\s*none/);
    expect(block).toMatch(/overflow-x:\s*auto/);
  });

  it("os keyframes do patrocínio continuam existindo (não foram alterados)", () => {
    expect(css).toContain("@keyframes marquee-fwd");
    expect(css).toContain("@keyframes marquee-rev");
  });
});
