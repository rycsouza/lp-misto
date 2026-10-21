import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

const h = vi.hoisted(() => ({
  labels: {} as Record<string, string>,
  reports: [] as unknown[],
}));

vi.mock("@/lib/config", () => ({
  getAllSectionMeta: async (keys: readonly string[]) =>
    Object.fromEntries(keys.map((k, i) => [k, { enabled: true, order: i + 1, label: h.labels[k] ?? "" }])),
  getSiteConfig: async () => ({ siteName: "Misto", clubLogoUrl: "/logo.png", instagram: "" }),
}));
vi.mock("@/lib/db/queries", () => ({
  getActiveAccountabilityReports: async () => h.reports,
}));
vi.mock("@/components/ui/CartIcon", () => ({ CartIcon: () => null }));
vi.mock("next/image", () => ({
  default: (props: { alt: string; src: string }) => createElement("img", { alt: props.alt, src: props.src }),
}));

import Header from "./Header";

async function renderHeader(hiddenSections: string[] = []): Promise<string> {
  return renderToStaticMarkup(await Header({ hiddenSections }));
}

beforeEach(() => {
  h.labels = {};
  h.reports = [];
});

describe("menu do site: texto do link com o rótulo da seção", () => {
  it("sem rótulo do clube, o link mostra o nome padrão", async () => {
    const html = await renderHeader();
    expect(html).toContain(">Notícias<");
    expect(html).toContain('href="/#noticias"');
  });

  it("com rótulo do clube, o link mostra o rótulo (o href continua o da âncora)", async () => {
    h.labels = { news: "Fique por Dentro" };
    const html = await renderHeader();
    expect(html).toContain(">Fique por Dentro<");
    expect(html).not.toContain(">Notícias<");
    expect(html).toContain('href="/#noticias"');
  });

  it("o Início usa o rótulo da seção hero (sem esconder o link)", async () => {
    h.labels = { hero: "Home do Clube" };
    const html = await renderHeader();
    expect(html).toContain(">Home do Clube<");
    expect(html).toContain('href="/#inicio"');
  });

  it("seção escondida pela plataforma continua sem link, mesmo com rótulo", async () => {
    h.labels = { shop: "Loja Oficial" };
    const html = await renderHeader(["shop"]);
    expect(html).not.toContain("Loja Oficial");
    expect(html).not.toContain('href="/#loja"');
  });

  it("o submenu Diretoria (com prestação de contas) usa o mesmo rótulo do link principal", async () => {
    h.labels = { board: "Gestão" };
    h.reports = [{ id: "r1" }];
    const html = await renderHeader();
    expect(html).toContain(">Gestão<");
    expect(html).toContain("Prestação de Contas");
    expect(html).not.toContain(">Diretoria<");
  });
});
