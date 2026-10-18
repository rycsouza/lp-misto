import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OfflinePanel } from "@/components/site/OfflinePanel";
import OfflinePage, { dynamic, metadata } from "@/app/offline/page";

describe("OfflinePanel - SSR sem carteirinha", () => {
  it("mostra o aviso e o botão de tentar de novo", () => {
    const html = renderToStaticMarkup(createElement(OfflinePanel));
    expect(html).toContain("Você está sem conexão");
    expect(html).toContain("Tentar de novo");
  });

  it("não renderiza carteirinha no servidor (ela vem do aparelho, no cliente)", () => {
    const html = renderToStaticMarkup(createElement(OfflinePanel));
    expect(html).not.toContain("Carteirinha de sócio-torcedor");
    expect(html).not.toContain("Carteirinha salva neste aparelho");
  });
});

describe("página /offline", () => {
  it("renderiza a mesma página sem banco nem dados do request", () => {
    const html = renderToStaticMarkup(createElement(OfflinePage));
    expect(html).toContain("Você está sem conexão");
  });

  it("é renderizada por requisição (o nonce da CSP exige isso) e fica fora do índice", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
