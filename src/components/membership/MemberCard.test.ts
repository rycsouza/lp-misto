import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemberCard, type MemberCardData } from "@/components/membership/MemberCard";

const TOKEN_QR = "https://clube.test/socios/carteirinha?token=11111111-2222-4333-8444-555555555555";

const baseCard: MemberCardData = {
  name: "Ana Torcedora",
  planName: "Carcará",
  programName: "Sócio-Torcedor",
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

describe("MemberCard - logo da empresa (plano empresarial)", () => {
  const LOGO = "https://res.cloudinary.com/misto-test/image/upload/c_pad,w_512,h_512,b_transparent,q_auto,f_auto/clube-a/socios/logos/abc123";

  it("com logo válido: aparece ao lado do nome da empresa, inteiro (object-contain), com alt vazio", () => {
    const html = render({ name: "Padaria Bom Pão Ltda", companyLogoUrl: LOGO });
    expect(html).toContain(`src="${LOGO}"`);
    expect(html).toContain("object-contain");
    expect(html).toContain('alt=""');
    expect(html).toContain("Padaria Bom Pão Ltda");
  });

  it("sem logo (ou logo recusado): nenhuma imagem extra no cartão", () => {
    expect(render({ name: "Ana", companyLogoUrl: null })).not.toContain("object-contain");
    expect(render({ name: "Ana", companyLogoUrl: "https://evil.test/x.png" })).not.toContain("evil.test");
    expect(render({ name: "Ana" })).not.toContain("<img");
  });
});

describe("MemberCard - logo do clube removido do cartão", () => {
  it("sem fundo: nenhuma imagem no cartão, mesmo com logo configurado; o nome do clube fica em texto", () => {
    const html = render({ clubLogoUrl: "https://cdn.exemplo.com.br/logo.png" });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("cdn.exemplo.com.br/logo.png");
    expect(html).toContain("Clube Teste");
  });
});

describe("MemberCard - fundo escolhido pelo clube", () => {
  const BG = "https://res.cloudinary.com/misto-test/image/upload/v1/misto/fundo.png";

  it("sem fundo (null): só o gradiente da cor do plano, sem véu nem imagem", () => {
    const html = render({ background: null });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("rgba(0, 0, 0, 0.3)");
    expect(html).not.toContain("rgba(255, 255, 255, 0.3)");
  });

  it("com fundo: <img> decorativa com o src, alt vazio e fora da leitura de tela", () => {
    const html = render({ background: { url: BG, fit: "cover", opacity: 100, blend: "multiply" } });
    const img = html.match(/<img[^>]*>/);
    expect(img).not.toBeNull();
    expect(img![0]).toContain(`src="${BG}"`);
    expect(img![0]).toContain('alt=""');
    expect(img![0]).toContain("object-cover");
    expect(img![0]).toContain("pointer-events-none");
  });

  it("fit 'contain' vira object-contain; 'cover' vira object-cover", () => {
    const contain = render({ background: { url: BG, fit: "contain", opacity: 100, blend: "multiply" } });
    expect(contain).toMatch(/<img[^>]*object-contain/);
    expect(contain).not.toMatch(/<img[^>]*object-cover/);
    const cover = render({ background: { url: BG, fit: "cover", opacity: 100, blend: "multiply" } });
    expect(cover).toMatch(/<img[^>]*object-cover/);
  });

  it("a opacidade (10 a 100) vira opacity no estilo da imagem", () => {
    expect(render({ background: { url: BG, fit: "cover", opacity: 40, blend: "multiply" } })).toMatch(/<img[^>]*opacity:0\.4/);
    expect(render({ background: { url: BG, fit: "cover", opacity: 10, blend: "multiply" } })).toMatch(/<img[^>]*opacity:0\.1/);
    expect(render({ background: { url: BG, fit: "cover", opacity: 100, blend: "multiply" } })).toMatch(/<img[^>]*opacity:1/);
  });

  it("o véu é escuro com texto claro (cartão de cor escura)", () => {
    // cor do plano escura: texto claro, então véu escuro
    const html = render({ cardColor: "#1E3A8A", background: { url: BG, fit: "cover", opacity: 100, blend: "normal" } });
    expect(html).toContain("rgba(0, 0, 0, 0.3)");
    expect(html).toContain("rgba(0, 0, 0, 0.5)");
  });

  it("o véu é claro com texto escuro (cartão de cor clara)", () => {
    const html = render({ cardColor: "#F5E6B8", background: { url: BG, fit: "cover", opacity: 100, blend: "normal" } });
    expect(html).toContain("rgba(255, 255, 255, 0.3)");
    expect(html).toContain("rgba(255, 255, 255, 0.5)");
  });

  it("o fundo também aparece sem benefício (cartão neutro)", () => {
    const html = render({ status: "pending", hasBenefits: false, background: { url: BG, fit: "cover", opacity: 100, blend: "multiply" } });
    expect(html).toContain(`src="${BG}"`);
  });

  it.each([
    "javascript:alert(1)",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "http://res.cloudinary.com/misto-test/image/upload/a.png",
    "//evil.example/x.png",
    'https://evil.example/a.png" onerror="alert(1)',
    'https://evil.example/a.png"><script>alert(1)</script>',
    "/../segredo.png",
    "",
  ])("URL hostil nunca vai para o HTML (%s)", (url) => {
    const html = render({ background: { url, fit: "cover", opacity: 100, blend: "multiply" } });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:image");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("evil.example");
    expect(html).not.toContain("onerror");
  });

  it("a imagem não cria botão nem muda a regra do QR", () => {
    const html = render({ background: { url: BG, fit: "cover", opacity: 100, blend: "multiply" } });
    expect(html).toMatch(/<button type="button"[^>]*aria-expanded="false"/);
    expect(html).toContain("Toque para mostrar o QR");
  });
});

describe("MemberCard - mescla da imagem com a cor do plano", () => {
  const BG = "https://res.cloudinary.com/misto-test/image/upload/v1/misto/fundo.png";
  const bg = (blend: "multiply" | "normal") => ({ url: BG, fit: "cover" as const, opacity: 100, blend });

  it("multiply: a <img> usa mix-blend-mode multiply e não há véu (scrim)", () => {
    const html = render({ background: bg("multiply") });
    const img = html.match(/<img[^>]*>/);
    expect(img).not.toBeNull();
    expect(img![0]).toMatch(/mix-blend-mode:multiply/);
    expect(html).not.toContain("rgba(0, 0, 0, 0.3)");
    expect(html).not.toContain("rgba(0, 0, 0, 0.5)");
    expect(html).not.toContain("rgba(255, 255, 255, 0.3)");
    expect(html).not.toContain("rgba(255, 255, 255, 0.5)");
  });

  it("normal: a <img> não tem mix-blend-mode e o véu sutil continua", () => {
    const html = render({ cardColor: "#1E3A8A", background: bg("normal") });
    const img = html.match(/<img[^>]*>/);
    expect(img![0]).not.toContain("mix-blend-mode");
    expect(html).toContain("rgba(0, 0, 0, 0.3)");
  });

  it("o cartão é o contexto de mistura (isolation: isolate), com ou sem imagem", () => {
    expect(render({ background: bg("multiply") })).toMatch(/isolation:isolate/);
    expect(render({ background: null })).toMatch(/isolation:isolate/);
  });

  it("sem imagem, nenhum mix-blend-mode aparece", () => {
    expect(render({ background: null })).not.toContain("mix-blend-mode");
  });

  it("com imagem, o texto ganha sombra leve; sem imagem, não", () => {
    expect(render({ background: bg("multiply") })).toContain("text-shadow:");
    expect(render({ background: null })).not.toContain("text-shadow");
  });

  it("a imagem não cobre a cor do plano: o fundo do cartão continua sendo o gradiente do plano", () => {
    const html = render({ cardColor: "#3F6212", clubColor: "#C19A5A", background: bg("multiply") });
    expect(html).toContain("#3f6212");
    expect(html).not.toContain("#c19a5a");
  });
});

describe("MemberCard - precedência da cor (plano, depois clube, depois dourado)", () => {
  it("a cor do plano vence a do clube", () => {
    const html = render({ cardColor: "#3F6212", clubColor: "#C19A5A" });
    expect(html).toContain("#3f6212");
    expect(html).not.toContain("#c19a5a");
  });

  it("sem cor no plano, usa a cor do clube", () => {
    const html = render({ cardColor: null, clubColor: "#123456" });
    expect(html).toContain("#123456");
  });

  it("sem cor no plano nem no clube, usa o dourado de reserva", () => {
    const html = render({ cardColor: null, clubColor: null });
    expect(html).toContain("#c19a5a");
  });
});

describe("MemberCard: nome do programa de sócio", () => {
  it("usa o nome do programa do clube no rótulo do cartão e no aria-label da seção", () => {
    const html = render({ programName: "Sócio Premium" });
    expect(html).toContain("Sócio Premium</p>");
    expect(html).toContain('aria-label="Carteirinha de Sócio Premium"');
    expect(html).not.toContain("Sócio-Torcedor");
  });

  it("sem o campo (cache antigo): mostra o padrão Sócio-Torcedor", () => {
    const withoutName: Partial<MemberCardData> = { ...baseCard };
    delete withoutName.programName;
    const html = renderToStaticMarkup(
      createElement(MemberCard, { card: withoutName as MemberCardData, siteName: "Clube Teste" }),
    );
    expect(html).toContain("Sócio-Torcedor</p>");
    expect(html).toContain('aria-label="Carteirinha de Sócio-Torcedor"');
  });

  it("nome com HTML nunca chega à tela: cai no padrão Sócio-Torcedor", () => {
    const html = render({ programName: "<i>Sócio</i>" });
    expect(html).not.toContain("<i>Sócio</i>");
    expect(html).not.toContain("&lt;i&gt;");
    expect(html).toContain("Sócio-Torcedor</p>");
  });
});

