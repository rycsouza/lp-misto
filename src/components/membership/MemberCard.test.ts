import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemberCard, type MemberCardData } from "@/components/membership/MemberCard";

const TOKEN_QR = "https://clube.test/socios/carteirinha?token=11111111-2222-4333-8444-555555555555";

const baseCard: MemberCardData = {
  name: "Ana Torcedora",
  planName: "Carcará",
  status: "active",
  memberSince: "2026-03-01T12:00:00.000Z",
  nextBillingDate: "2026-11-10T12:00:00.000Z",
  cardColor: "#1E3A8A",
  clubColor: "#123456",
  clubLogoUrl: null,
  benefits: [],
  hasDiscounts: false,
  hasBenefits: true,
  qrValue: TOKEN_QR,
  memberCode: "S-1A2B3C4D",
};

const render = (over: Partial<MemberCardData> = {}) =>
  renderToStaticMarkup(createElement(MemberCard, { card: { ...baseCard, ...over }, siteName: "Clube Teste" }));

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Abertura da tag do painel do QR (o elemento apontado por aria-controls). */
function panelTag(html: string): string {
  const controls = html.match(/aria-controls="([^"]+)"/);
  expect(controls, "o botão precisa apontar para o painel").not.toBeNull();
  const tag = html.match(new RegExp(`<div id="${escapeRe(controls![1])}"[^>]*>`));
  expect(tag, "o painel apontado por aria-controls precisa existir").not.toBeNull();
  return tag![0];
}

describe("MemberCard - carteirinha com benefício (QR recolhido)", () => {
  it("o cartão é um botão com aria-expanded=false e aria-controls do painel", () => {
    const html = render();
    expect(html).toMatch(/<button type="button"[^>]*aria-expanded="false"/);
    expect(html).toMatch(/aria-controls="[^"]+"/);
  });

  it("o painel do QR começa oculto: aria-hidden=true e inert", () => {
    const tag = panelTag(render());
    expect(tag).toContain('aria-hidden="true"');
    expect(tag).toContain('inert=""');
  });

  it("o QR e o código ficam dentro do painel recolhido (não soltos na página)", () => {
    const html = render();
    const start = html.indexOf(panelTag(html));
    const code = html.indexOf("Código: S-1A2B3C4D");
    expect(code).toBeGreaterThan(start);
    expect(html.indexOf("Apresente quando solicitado")).toBeGreaterThan(start);
    expect(html.indexOf("Ocultar QR")).toBeGreaterThan(start);
  });

  it("o botão tem nome acessível com o estado (mostrar QR) e a dica visível", () => {
    const html = render();
    expect(html).toContain("Mostrar QR");
    expect(html).toContain("Toque para mostrar o QR");
  });

  it("animações são só motion-safe (sem transição de movimento para quem pede menos movimento)", () => {
    const html = render();
    expect(html).toContain("motion-safe:transition-[grid-template-rows]");
    expect(html).toContain("motion-safe:transition-transform");
    // Nenhuma transição de movimento sem o prefixo motion-safe.
    expect(html).not.toMatch(/(^|[\s"])transition-transform/);
    expect(html).not.toMatch(/(^|[\s"])transition-\[grid-template-rows\]/);
  });

  it("não expõe campos fora do contrato da carteirinha (e-mail, CPF, telefone)", () => {
    const html = render({
      ...({ email: "ana@clube.test", cpf: "123.456.789-00", phone: "11999990000" } as object),
    } as Partial<MemberCardData>);
    expect(html).not.toContain("ana@clube.test");
    expect(html).not.toContain("123.456.789-00");
    expect(html).not.toContain("11999990000");
  });
});

describe("MemberCard - sem benefício", () => {
  it("não tem botão, painel, QR nem código", () => {
    const html = render({ status: "pending", hasBenefits: false, memberCode: "S-1A2B3C4D" });
    expect(html).not.toMatch(/<button/);
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toContain("aria-controls");
    expect(html).not.toContain("Identificação de sócio");
    expect(html).not.toContain("Código:");
    expect(html).not.toContain("Toque para");
    expect(html).not.toContain("token=");
  });

  it("mostra o selo da situação no cartão neutro", () => {
    const html = render({ status: "suspended", hasBenefits: false });
    expect(html).toContain("SUSPENSO");
  });
});
