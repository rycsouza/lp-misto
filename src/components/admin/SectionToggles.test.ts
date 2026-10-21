import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/admin", () => ({
  updateConfigValues: async () => {},
}));

import { buildSectionUpdates, SectionToggles } from "./SectionToggles";

const SECTIONS = [
  { key: "hero", label: "Hero", enabled: true, order: 0 },
  { key: "membership", label: "Sócio-Torcedor", enabled: false, order: 1 },
];

describe("buildSectionUpdates (lote gravado pela aba Seções)", () => {
  it("grava enabled e order por posição, e o toggle do mural no mesmo lote", () => {
    expect(buildSectionUpdates(SECTIONS, true)).toEqual({
      "section.hero.enabled": "true",
      "section.hero.order": "0",
      "section.membership.enabled": "false",
      "section.membership.order": "1",
      "section.member_wall.enabled": "true",
    });
  });

  it("mural desligado vira 'false' (nunca outro texto)", () => {
    expect(buildSectionUpdates(SECTIONS, false)["section.member_wall.enabled"]).toBe("false");
  });

  it("não grava campo de ordem para o mural (ele não é ordenável)", () => {
    expect(Object.keys(buildSectionUpdates(SECTIONS, true))).not.toContain("section.member_wall.order");
  });
});

describe("SectionToggles: checkbox do mural dos sócios", () => {
  const render = (memberWallEnabled: boolean) =>
    renderToStaticMarkup(createElement(SectionToggles, { sections: SECTIONS, memberWallEnabled }));

  it("mostra o toggle com o rótulo e a dica de dependência da seção Sócio-Torcedor", () => {
    const html = render(true);
    expect(html).toContain("Mural dos sócios (acima dos planos de sócio)");
    expect(html).toContain('aria-label="Exibir mural dos sócios"');
    expect(html).toContain("Se ela estiver desligada, o mural também some.");
  });

  it("reflete o valor atual: marcado quando ligado, desmarcado quando desligado", () => {
    const on = render(true);
    const off = render(false);
    // A tag <input> que contém o aria-label do mural (o atributo checked fica nela).
    const wallInput = (html: string) => html.match(/<input[^>]*aria-label="Exibir mural dos sócios"[^>]*>/)?.[0] ?? "";
    expect(wallInput(on)).toMatch(/checked=""/);
    expect(wallInput(off)).not.toMatch(/checked=""/);
  });
});
