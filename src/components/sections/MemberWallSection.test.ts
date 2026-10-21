import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { WallCard, WallView } from "@/lib/membership/wall";

const h = vi.hoisted(() => ({
  flags: {} as Record<string, boolean>,
  wall: null as WallView | Error | null,
  wallCalls: 0,
  siteName: "Clube A",
  tagline: "",
  primaryColor: "#1f3a93" as string | null,
}));

vi.mock("@/lib/config", () => ({
  getSiteConfig: async () => ({ siteName: h.siteName, tagline: h.tagline, primaryColor: h.primaryColor }),
  getSectionEnabled: async (key: string) => h.flags[key] ?? true,
}));
vi.mock("@/lib/membership/wall", () => ({
  getHomeWallView: async () => {
    h.wallCalls++;
    if (h.wall instanceof Error) throw h.wall;
    return h.wall;
  },
}));
// O carrossel é coberto pelo próprio teste; aqui só registramos as props que a seção envia.
vi.mock("@/components/membership/WallCarousel", async () => {
  const { createElement } = await import("react");
  return {
    WallCarousel: (props: { label: string; cards: { name: string; cardColor: string | null }[] }) =>
      createElement(
        "div",
        { "data-carousel": props.label, "data-colors": props.cards.map((c) => c.cardColor).join("|") },
        props.cards.map((c) => c.name).join(","),
      ),
  };
});

import MemberWallSection, { MemberWallContent } from "./MemberWallSection";
import SectionWrapper from "@/components/ui/section-wrapper";

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

async function renderWall(label?: string): Promise<string> {
  const el = await MemberWallContent({ label });
  return el ? renderToStaticMarkup(el) : "";
}

beforeEach(() => {
  h.flags = {};
  h.wall = wallView([card({ name: "Ana" }), card({ name: "Bia", cardColor: "#ff0000" })]);
  h.wallCalls = 0;
  h.siteName = "Clube A";
  h.tagline = "";
  h.primaryColor = "#1f3a93";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mural dos sócios: seção própria da home", () => {
  it("com sócios: título, contador, carrossel e link do mural completo, com âncora #mural", async () => {
    const html = await renderWall();
    expect(html).toContain('id="mural"');
    expect(html).toContain("Quem já é sócio");
    expect(html).toContain("2 torcedores já são sócios");
    expect(html).toContain('data-carousel="Sócios de Clube A"');
    expect(html).toContain('href="/socios/mural"');
    expect(html).toContain("Ver mural completo");
    expect(h.wallCalls).toBe(1);
  });

  it("usa a cor do clube quando o plano do sócio não tem cor", async () => {
    const html = await renderWall();
    expect(html).toContain("#1f3a93|#ff0000");
  });

  it("o nome do carrossel usa a tagline do clube quando existe", async () => {
    h.tagline = "O Carcará";
    const html = await renderWall();
    expect(html).toContain('data-carousel="Sócios de O Carcará"');
  });

  it("aparece ligado mesmo com a seção de sócio desligada (é independente dela)", async () => {
    h.flags["membership"] = false;
    const rendered = await SectionWrapper({ sectionKey: "member_wall", children: await MemberWallContent() });
    expect(rendered).not.toBeNull();
    expect(renderToStaticMarkup(rendered as React.ReactElement)).toContain("Quem já é sócio");
  });

  it("o componente de seção é envolvido pelo SectionWrapper da chave member_wall", async () => {
    const tree = (await MemberWallSection({})) as React.ReactElement<{ sectionKey: string }>;
    expect(tree.type).toBe(SectionWrapper);
    expect(tree.props.sectionKey).toBe("member_wall");
  });
});

describe("mural dos sócios: quando não aparece", () => {
  it("desligado (section.member_wall.enabled = false): some e o conteúdo nem é executado", async () => {
    h.flags["member_wall"] = false;
    // Como na página: o filho do wrapper é um elemento não executado; só roda se a seção estiver ligada.
    const tree = (await MemberWallSection({})) as React.ReactElement<{ sectionKey: string; children: React.ReactElement }>;
    const rendered = await SectionWrapper(tree.props);
    expect(rendered).toBeNull();
    expect(h.wallCalls).toBe(0);
  });

  it("ligado: o wrapper deixa o conteúdo do mural passar (o HTML é coberto nos testes acima)", async () => {
    const tree = (await MemberWallSection({})) as React.ReactElement<{ sectionKey: string; children: React.ReactElement }>;
    const rendered = (await SectionWrapper(tree.props)) as React.ReactElement<{ children: React.ReactElement }>;
    expect(rendered).not.toBeNull();
    expect(rendered.props.children.type).toBe(MemberWallContent);
  });

  it("sem nenhum sócio no mural: não renderiza e não mostra mosaico de vagas", async () => {
    h.wall = wallView([]);
    expect(await renderWall()).toBe("");
  });

  it("falha ao ler o mural: não renderiza, sem vazar a mensagem do erro", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    h.wall = new Error("conexão recusada com senha=segredo-123");
    expect(await renderWall()).toBe("");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(spy.mock.calls)).not.toContain("segredo-123");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("senha");
  });
});

describe("mural dos sócios: rótulo da seção", () => {
  it("o rótulo do clube substitui o título do mural", async () => {
    const html = await renderWall("Torcida Sócia");
    expect(html).toContain("Torcida Sócia");
    expect(html).not.toContain("Quem já é sócio");
  });

  it("sem rótulo, o título padrão", async () => {
    expect(await renderWall(undefined)).toContain("Quem já é sócio");
  });
});
