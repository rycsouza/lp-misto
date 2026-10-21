import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/admin", () => ({
  updateConfigValues: async () => {},
}));

import {
  buildSectionUpdates,
  SectionToggles,
  type SectionToggleItem,
  validateSectionLabelDraft,
} from "./SectionToggles";

const SECTIONS: SectionToggleItem[] = [
  { key: "hero", label: "Hero", customLabel: "", enabled: true, order: 0 },
  { key: "shop", label: "Loja", customLabel: "Loja Oficial", enabled: false, order: 1 },
  { key: "member_wall", label: "Mural dos sócios", customLabel: "", enabled: true, order: 2 },
];

describe("buildSectionUpdates (lote gravado pela aba Seções)", () => {
  it("grava enabled, order (posição) e label de cada seção no mesmo lote", () => {
    expect(
      buildSectionUpdates([
        { key: "hero", enabled: true, customLabel: "" },
        { key: "shop", enabled: false, customLabel: "Loja Oficial" },
      ]),
    ).toEqual({
      "section.hero.enabled": "true",
      "section.hero.order": "0",
      "section.hero.label": "",
      "section.shop.enabled": "false",
      "section.shop.order": "1",
      "section.shop.label": "Loja Oficial",
    });
  });

  it("a ordem segue a posição da lista (arrastar muda o order gravado)", () => {
    const reordered = [SECTIONS[2], SECTIONS[0]];
    const updates = buildSectionUpdates(reordered.map((s) => ({ key: s.key, enabled: s.enabled, customLabel: s.customLabel })));
    expect(updates["section.member_wall.order"]).toBe("0");
    expect(updates["section.hero.order"]).toBe("1");
  });

  it("o mural dos sócios é gravado como qualquer seção (enabled, order e label)", () => {
    const updates = buildSectionUpdates([{ key: "member_wall", enabled: false, customLabel: "Torcida Sócia" }]);
    expect(updates).toEqual({
      "section.member_wall.enabled": "false",
      "section.member_wall.order": "0",
      "section.member_wall.label": "Torcida Sócia",
    });
  });

  it("rótulo vazio grava vazio (volta ao padrão no site)", () => {
    expect(buildSectionUpdates([{ key: "news", enabled: true, customLabel: "" }])["section.news.label"]).toBe("");
  });
});

describe("validateSectionLabelDraft (campo de nome, antes de confirmar)", () => {
  it("vazio ou só espaços volta ao padrão", () => {
    expect(validateSectionLabelDraft("")).toEqual({ ok: true, value: "" });
    expect(validateSectionLabelDraft("   ")).toEqual({ ok: true, value: "" });
  });

  it("texto válido é trimado e aceito", () => {
    expect(validateSectionLabelDraft("  Loja Oficial ")).toEqual({ ok: true, value: "Loja Oficial" });
    expect(validateSectionLabelDraft("Sócio-Ação")).toEqual({ ok: true, value: "Sócio-Ação" });
  });

  it.each(["A", "<b>Loja</b>", "Loja 🛒", "Loja  X", "a".repeat(41)])("recusa %j com a dica de uso", (draft) => {
    const result = validateSectionLabelDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("2 a 40 caracteres");
  });
});

describe("SectionToggles: lista ordenável com edição do nome", () => {
  const render = (sections: SectionToggleItem[]) =>
    renderToStaticMarkup(createElement(SectionToggles, { sections }));

  it("cada linha tem o lápis com o nome padrão da seção", () => {
    const html = render(SECTIONS);
    expect(html).toContain('aria-label="Editar nome da seção Hero"');
    expect(html).toContain('aria-label="Editar nome da seção Loja"');
    expect(html).toContain('aria-label="Editar nome da seção Mural dos sócios"');
  });

  it("o mural dos sócios aparece na lista, sem o checkbox avulso antigo", () => {
    const html = render(SECTIONS);
    expect(html).toContain("Mural dos sócios");
    expect(html).toContain('aria-label="Exibir seção Mural dos sócios"');
    expect(html).not.toContain('aria-label="Exibir mural dos sócios"');
    expect(html).not.toContain("acima dos planos de sócio");
  });

  it("mostra o rótulo do clube na linha e o padrão menor entre parênteses", () => {
    const html = render(SECTIONS);
    expect(html).toContain("Loja Oficial");
    expect(html).toContain("(padrão: Loja)");
  });

  it("sem rótulo do clube, mostra só o padrão e sem a dica de padrão", () => {
    const html = render([SECTIONS[0]]);
    expect(html).toContain(">Hero<");
    expect(html).not.toContain("(padrão:");
  });

  it("ordena pela ordem gravada, não pela ordem em que a lista chega", () => {
    // O mural chega primeiro no array, mas tem order 2; o Hero tem order 0 e sai antes.
    const html = render([SECTIONS[2], SECTIONS[0]]);
    expect(html.indexOf(">Hero<")).toBeLessThan(html.indexOf("Exibir seção Mural dos sócios"));
  });

  it("o campo de edição não aparece antes de clicar no lápis", () => {
    expect(render(SECTIONS)).not.toContain('aria-label="Nome da seção');
  });
});
