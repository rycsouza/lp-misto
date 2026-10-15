import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlanCard, type PlanCardData } from "@/components/membership/PlanCard";

const basePlan: PlanCardData = {
  name: "Ouro",
  description: null,
  priceCents: 9990,
  highlight: false,
  cardColor: null,
  promoFirstMonthFree: false,
  benefitLines: [],
};

const render = (plan: Partial<PlanCardData>, interactive?: boolean) =>
  renderToStaticMarkup(
    createElement(PlanCard, { plan: { ...basePlan, ...plan }, interactive })
  );

describe("PlanCard - efeito de hover (vitrine)", () => {
  it("sem interactive (prévia do admin) não aplica nenhum efeito de hover/foco", () => {
    const html = render({});
    expect(html).not.toContain("hover:");
    expect(html).not.toContain("focus-within:");
    expect(html).not.toContain("group");
    expect(html).toContain("transition-transform");
  });

  it("com interactive aplica elevação só com motion-safe e foco por focus-within", () => {
    const html = render({}, true);
    expect(html).toContain("motion-safe:hover:-translate-y-1");
    expect(html).toContain("motion-safe:focus-within:-translate-y-1");
    expect(html).toContain("hover:shadow-[");
    expect(html).toContain("focus-within:shadow-[");
    expect(html).toContain("group");
    expect(html).toContain("hover:z-10");
  });

  it("sem cor do plano usa a primária no hover da borda", () => {
    const html = render({}, true);
    expect(html).toContain("hover:border-primary/60");
    expect(html).not.toContain("--plan-accent");
  });

  it("cor válida vai para a variável CSS e também alimenta a borda e o brilho", () => {
    const html = render({ cardColor: "#C19A5A", highlight: true }, true);
    expect(html).toContain("--plan-accent:#c19a5a");
    expect(html).toContain("--plan-glow:#c19a5a66");
    expect(html).toContain("border-[color:var(--plan-accent)]");
    expect(html).toContain("shadow-[0_0_28px_var(--plan-glow,");
  });

  it("cor inválida nunca chega ao style nem à classe (sem injeção de CSS)", () => {
    const hostile = "red;background:url(https://evil.example/x.png)";
    const html = render({ cardColor: hostile }, true);
    expect(html).not.toContain("evil.example");
    expect(html).not.toContain("--plan-accent");
    expect(html).not.toContain("style=");
  });
});
