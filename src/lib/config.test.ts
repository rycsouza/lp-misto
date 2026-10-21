import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * getSiteConfig expõe membershipProgramName: padrão "Sócio-Torcedor" quando a chave
 * está vazia, ausente ou inválida no banco; o nome configurado quando é válido.
 */
const h = vi.hoisted(() => ({
  rows: [] as { key: string; value: string; type: string }[],
  fail: false,
}));

vi.mock("@/lib/db/queries", () => ({
  getAllSiteConfig: async () => {
    if (h.fail) throw new Error("banco indisponível");
    return h.rows;
  },
}));

import { getAllSectionMeta, getSiteConfig } from "./config";
import { HOME_SECTION_KEYS } from "./section-meta";

beforeEach(() => {
  h.rows = [];
  h.fail = false;
});

describe("getSiteConfig: nome do programa de sócio", () => {
  it("sem a chave no banco: usa Sócio-Torcedor", async () => {
    const config = await getSiteConfig();
    expect(config.membershipProgramName).toBe("Sócio-Torcedor");
  });

  it("chave gravada vazia: usa Sócio-Torcedor", async () => {
    h.rows = [{ key: "membershipProgramName", value: "", type: "string" }];
    expect((await getSiteConfig()).membershipProgramName).toBe("Sócio-Torcedor");
  });

  it("nome válido gravado: devolve o nome configurado", async () => {
    h.rows = [{ key: "membershipProgramName", value: "Sócio Premium", type: "string" }];
    expect((await getSiteConfig()).membershipProgramName).toBe("Sócio Premium");
  });

  it("valor inválido no banco (ex.: HTML, linha antiga): cai no padrão, sem vazar o valor", async () => {
    h.rows = [{ key: "membershipProgramName", value: "<img src=x onerror=alert(1)>", type: "string" }];
    const config = await getSiteConfig();
    expect(config.membershipProgramName).toBe("Sócio-Torcedor");
    expect(JSON.stringify(config)).not.toContain("onerror");
  });

  it("falha de leitura do banco: devolve o padrão sem lançar", async () => {
    h.fail = true;
    expect((await getSiteConfig()).membershipProgramName).toBe("Sócio-Torcedor");
  });
});

describe("getAllSectionMeta: ordem, ligada e rótulo das seções", () => {
  it("sem linhas no banco: todas ligadas, sem rótulo, e o mural logo antes da sócio", async () => {
    const meta = await getAllSectionMeta(HOME_SECTION_KEYS);
    expect(Object.values(meta).every((m) => m.enabled && m.label === "")).toBe(true);
    expect(meta.member_wall.order).toBeLessThan(meta.membership.order);
    expect(meta.member_wall.order).toBeGreaterThan(meta.history.order);
  });

  it("lê enabled, order e label gravados; rótulo inválido vira vazio (padrão)", async () => {
    h.rows = [
      { key: "section.news.enabled", value: "false", type: "boolean" },
      { key: "section.shop.order", value: "0", type: "number" },
      { key: "section.shop.label", value: "Loja Oficial", type: "string" },
      { key: "section.squad.label", value: "<b>Elenco</b>", type: "string" },
    ];
    const meta = await getAllSectionMeta(HOME_SECTION_KEYS);
    expect(meta.news.enabled).toBe(false);
    expect(meta.shop.order).toBe(0);
    expect(meta.shop.label).toBe("Loja Oficial");
    expect(meta.squad.label).toBe("");
    expect(JSON.stringify(meta)).not.toContain("<b>");
  });

  it("com ordens gravadas das demais: o mural sem ordem cai logo antes da sócio", async () => {
    const saved = ["hero", "ticket_highlight", "news", "squad", "board", "history", "membership", "sponsors", "shop", "raffle"];
    h.rows = saved.map((k, i) => ({ key: `section.${k}.order`, value: String(i), type: "number" }));
    const meta = await getAllSectionMeta(HOME_SECTION_KEYS);
    expect(meta.member_wall.order).toBe(5.5);
    expect(meta.member_wall.order).toBeGreaterThan(meta.history.order);
    expect(meta.member_wall.order).toBeLessThan(meta.membership.order);
  });

  it("ordem gravada inválida não vira posição: cai na derivação padrão", async () => {
    h.rows = [{ key: "section.news.order", value: "abc", type: "number" }];
    const meta = await getAllSectionMeta(["hero", "news"]);
    expect(meta.news.order).toBe(2);
  });

  it("falha de leitura do banco: tudo ligado, sem rótulo, sem lançar", async () => {
    h.fail = true;
    const meta = await getAllSectionMeta(HOME_SECTION_KEYS);
    expect(Object.values(meta).every((m) => m.enabled && m.label === "")).toBe(true);
  });
});
