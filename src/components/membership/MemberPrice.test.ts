import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemberPrice } from "./MemberPrice";

const render = (props: Partial<Parameters<typeof MemberPrice>[0]>) =>
  renderToStaticMarkup(
    createElement(MemberPrice, { shownCents: 10000, strikeCents: 10000, pct: 10, planName: "Ouro", ...props })
  );

describe("MemberPrice (preço de sócio)", () => {
  it("com desconto: preço cheio riscado, preço de sócio em destaque e selo", () => {
    const html = render({});
    expect(html).toContain("line-through");
    expect(html).toMatch(/100,00/);
    expect(html).toMatch(/90,00/);
    expect(html).toContain("Sócio Ouro −10%");
    // o riscado vem antes do preço de sócio
    expect(html.indexOf("100,00")).toBeLessThan(html.indexOf("90,00"));
  });

  it("sem desconto (0%) não renderiza nada: quem não é sócio não vê mudança", () => {
    expect(render({ pct: 0 })).toBe("");
  });

  it("sem preço cheio para riscar (ex.: a partir de) não risca", () => {
    const html = render({ strikeCents: null, label: "A partir de" });
    expect(html).not.toContain("line-through");
    expect(html).toContain("A partir de");
    expect(html).toMatch(/90,00/);
  });

  it("escapa o nome do plano (sem injeção de HTML)", () => {
    const html = render({ planName: "<img src=x onerror=alert(1)>" });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
