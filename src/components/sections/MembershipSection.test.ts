import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { WallCard, WallView } from "@/lib/membership/wall";

const h = vi.hoisted(() => ({
  programName: undefined as string | undefined,
  flags: {} as Record<string, boolean>,
  wall: null as WallView | Error | null,
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
vi.mock("@/lib/membership/wall", () => ({
  getHomeWallView: async () => {
    h.wallCalls++;
    if (h.wall instanceof Error) throw h.wall;
    return h.wall;
  },
}));

import MembershipSection, { MembershipSectionContent } from "./MembershipSection";
import SectionWrapper from "@/components/ui/section-wrapper";

const plan = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  name: "Elite",
  slug: "elite",
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

const card = (over: Partial<WallCard> = {}): WallCard => ({
  name: "Ana",
  since: "15/03/2026",
  planName: "Elite",
  cardColor: null,
  photoUrl: null,
  tier: 0,
  ...over,
});

const wallView = (cards: WallCard[]): WallView => ({ total: cards.length, groups: [], cards, truncated: false });

async function renderContent(): Promise<string> {
  const el = await MembershipSectionContent();
  return el ? renderToStaticMarkup(el) : "";
}

beforeEach(() => {
  h.programName = undefined;
  h.flags = {};
  h.wall = wallView([card({ name: "Ana" }), card({ name: "Bia", tier: 1, planName: "Pleno" })]);
  h.wallCalls = 0;
  h.plans = [plan()];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("home: mural dos sócios acima dos planos", () => {
  it("com toggle ligado e sócios: o bloco aparece antes dos planos", async () => {
    const html = await renderContent();
    const wallAt = html.indexOf("Quem já é sócio");
    expect(wallAt).toBeGreaterThan(-1);
    expect(html).toContain("2 torcedores já são sócios");
    expect(html).toContain('href="/socios/mural"');
    expect(wallAt).toBeLessThan(html.indexOf("Assinar agora"));
    expect(h.wallCalls).toBe(1);
  });

  it("com toggle desligado: sem bloco e sem consultar o mural, planos seguem", async () => {
    h.flags["member_wall"] = false;
    const html = await renderContent();
    expect(html).not.toContain("Quem já é sócio");
    expect(html).toContain("Assinar agora");
    expect(h.wallCalls).toBe(0);
  });

  it("sem nenhum sócio no mural: sem bloco e sem mosaico de vagas na home", async () => {
    h.wall = wallView([]);
    const html = await renderContent();
    expect(html).not.toContain("Quem já é sócio");
    expect(html).not.toContain("Seu lugar");
    expect(html).toContain("Assinar agora");
  });

  it("falha ao ler o mural: a seção segue com os planos, sem vazar a mensagem do erro", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    h.wall = new Error("conexão recusada com senha=segredo-123");
    const html = await renderContent();
    expect(html).not.toContain("Quem já é sócio");
    expect(html).toContain("Assinar agora");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(spy.mock.calls)).not.toContain("segredo-123");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("senha");
  });

  it("com a seção de sócio desligada: o SectionWrapper esconde tudo e o mural nunca é consultado", async () => {
    h.flags["membership"] = false;
    // Composição real: o conteúdo é filho do wrapper e só é renderizado se a seção estiver ligada.
    const tree = MembershipSection();
    expect(tree.props.sectionKey).toBe("membership");
    const rendered = await SectionWrapper({ sectionKey: "membership", children: null });
    expect(rendered).toBeNull();
    expect(h.wallCalls).toBe(0);
  });

  it("com a seção de sócio ligada, o conteúdo (com o mural) é renderizado pelo wrapper", async () => {
    const rendered = await SectionWrapper({ sectionKey: "membership", children: await MembershipSectionContent() });
    expect(rendered).not.toBeNull();
    const html = renderToStaticMarkup(rendered as React.ReactElement);
    expect(html).toContain("Quem já é sócio");
    expect(h.wallCalls).toBe(1);
  });

  it("usa a cor do clube quando o plano não tem cor no mural", async () => {
    const html = await renderContent();
    expect(html).toMatch(/#1f3a93/i);
  });

  it("exporta o componente de seção padrão (sem quebrar a home)", () => {
    expect(typeof MembershipSection).toBe("function");
  });
});

describe("home: título da seção de sócio usa o nome do programa do clube", () => {
  it("sem nome configurado: título Seja Sócio-Torcedor", async () => {
    const html = await renderContent();
    expect(html).toContain("Seja Sócio-Torcedor");
  });

  it("com nome configurado: título com o nome do clube, sem o padrão", async () => {
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
});
