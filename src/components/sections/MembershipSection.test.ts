import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const h = vi.hoisted(() => ({
  programName: undefined as string | undefined,
  flags: {} as Record<string, boolean>,
  wallCalls: 0,
  plans: [] as unknown[],
}));

vi.mock("@/app/actions/membership", () => ({
  getPublicMembershipPlans: async () => h.plans,
  getActiveGatewayInfo: async () => null,
}));
vi.mock("@/lib/config", () => ({
  getSiteConfig: async () => ({
    siteName: "Clube A",
    tagline: "",
    primaryColor: "#1f3a93",
    membershipProgramName: h.programName,
  }),
  getSectionEnabled: async (key: string) => h.flags[key] ?? true,
}));
// O mural agora é seção própria: se a seção de sócio o consultar, o teste acusa.
vi.mock("@/lib/membership/wall", () => ({
  getHomeWallView: async () => {
    h.wallCalls++;
    return { total: 1, groups: [], cards: [], truncated: false };
  },
}));

import MembershipSection, { MembershipSectionContent } from "./MembershipSection";
import SectionWrapper from "@/components/ui/section-wrapper";

const plan = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  name: "Elite",
  slug: "elite",
  audience: "pf",
  icon: "star",
  description: null,
  priceCents: 7990,
  ticketDiscountPct: 0,
  productDiscountPct: 0,
  freeTicketsPerHomeGame: 0,
  highlight: false,
  highlightLabel: null,
  cardColor: null,
  promoFirstMonthFree: false,
  promoEndsAt: null,
  benefits: [],
  ...over,
});

async function renderContent(label?: string): Promise<string> {
  const el = await MembershipSectionContent({ label });
  return el ? renderToStaticMarkup(el) : "";
}

beforeEach(() => {
  h.programName = undefined;
  h.flags = {};
  h.wallCalls = 0;
  h.plans = [plan()];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("seção de sócio: sem o mural (ele é uma seção própria)", () => {
  it("não renderiza o mural e não consulta o mural, mesmo com sócios", async () => {
    const html = await renderContent();
    expect(html).not.toContain("Quem já é sócio");
    expect(html).not.toContain('id="mural"');
    expect(html).toContain("Assinar agora");
    expect(h.wallCalls).toBe(0);
  });

  it("o link do mural completo segue na seção de sócio (ponte para a página)", async () => {
    const html = await renderContent();
    expect(html).toContain('href="/socios/mural"');
  });

  it("sem planos a seção não aparece", async () => {
    h.plans = [];
    expect(await renderContent()).toBe("");
  });

  it("o componente de seção continua exportado e envolvido pelo SectionWrapper da chave membership", () => {
    const tree = MembershipSection();
    expect(tree.props.sectionKey).toBe("membership");
    expect(tree.type).toBe(SectionWrapper);
  });

  it("com a seção de sócio desligada, o SectionWrapper esconde tudo", async () => {
    h.flags["membership"] = false;
    const rendered = await SectionWrapper({ sectionKey: "membership", children: await MembershipSectionContent() });
    expect(rendered).toBeNull();
  });
});

describe("título da seção de sócio", () => {
  it("sem nome configurado: título Seja Sócio-Torcedor", async () => {
    const html = await renderContent();
    expect(html).toContain("Seja Sócio-Torcedor");
  });

  it("com nome do programa configurado: título com o nome do clube, sem o padrão", async () => {
    h.programName = "Sócio Premium";
    const html = await renderContent();
    expect(html).toContain("Seja Sócio Premium");
    expect(html).not.toContain("Sócio-Torcedor");
  });

  it("valor inválido no config: cai no padrão e o HTML não entra na página", async () => {
    h.programName = "<img src=x onerror=alert(1)>";
    const html = await renderContent();
    expect(html).toContain("Seja Sócio-Torcedor");
    expect(html).not.toContain("onerror");
  });

  it("rótulo da seção (aba Seções) vence o Seja {programa}", async () => {
    h.programName = "Sócio Premium";
    const html = await renderContent("Torcida Sócia");
    expect(html).toContain("Torcida Sócia");
    expect(html).not.toContain("Seja Sócio Premium");
  });
});

describe("vitrine: planos separados por público (CPF e CNPJ)", () => {
  const pj = (over: Record<string, unknown> = {}) =>
    plan({ id: "p-emp", name: "Empresarial", slug: "empresarial", audience: "pj", priceCents: 24900, ...over });

  it("CPF em cima sob 'Planos para você'; CNPJ embaixo sob 'Planos para empresas' com o subtítulo", async () => {
    h.plans = [pj(), plan({ id: "p-raiz", name: "Raiz", slug: "raiz" })];
    const html = await renderContent();
    const iVoce = html.indexOf("Planos para você");
    const iEmpresas = html.indexOf("Planos para empresas");
    expect(iVoce).toBeGreaterThan(-1);
    expect(iEmpresas).toBeGreaterThan(iVoce);
    expect(html.indexOf("Raiz")).toBeLessThan(iEmpresas);
    expect(html.indexOf("Empresarial")).toBeGreaterThan(iEmpresas);
    expect(html).toContain("Para CNPJ: divulgação da marca e benefícios para a empresa");
  });

  it("só planos de CNPJ: não mostra o título 'Planos para você'", async () => {
    h.plans = [pj()];
    const html = await renderContent();
    expect(html).not.toContain("Planos para você");
    expect(html).toContain("Planos para empresas");
    expect(html).toContain("Empresarial");
  });

  it("só planos de CPF: não mostra o título 'Planos para empresas' nem o subtítulo de CNPJ", async () => {
    h.plans = [plan()];
    const html = await renderContent();
    expect(html).toContain("Planos para você");
    expect(html).not.toContain("Planos para empresas");
    expect(html).not.toContain("Para CNPJ");
  });

  it("o destaque segue funcionando dentro do grupo de CNPJ", async () => {
    h.plans = [plan(), pj({ highlight: true, highlightLabel: "PARCEIRO OFICIAL" })];
    const html = await renderContent();
    expect(html.indexOf("PARCEIRO OFICIAL")).toBeGreaterThan(html.indexOf("Planos para empresas"));
  });
});

describe("planos centralizados", () => {
  it("linha de planos usa flex-wrap centralizado (linha incompleta fica no centro)", async () => {
    h.plans = [plan({ id: "a", slug: "a" }), plan({ id: "b", slug: "b" }), plan({ id: "c", slug: "c" })];
    const html = await renderContent();
    expect(html).toContain("flex flex-wrap justify-center");
    expect(html).not.toContain("lg:grid-cols-4");
    expect((html.match(/lg:w-\[calc\(25%-0\.75rem\)\]/g) ?? []).length).toBe(3);
  });
});
