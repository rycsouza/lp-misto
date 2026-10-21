import { describe, expect, it } from "vitest";
import {
  getSectionLabel,
  HOME_SECTION_KEYS,
  isValidSectionLabelConfigValue,
  isValidSectionLabelText,
  orderHomeSections,
  resolveSectionLabel,
  resolveSectionOrders,
  savedSectionOrders,
  sectionLabelKey,
} from "./section-meta";
import { isValidLabelText } from "./label-rule";

/** Ordem final da home a partir das ordens efetivas (o que o site ordena). */
function homeOrder(saved: Record<string, number>, keys: readonly string[] = HOME_SECTION_KEYS): string[] {
  const orders = resolveSectionOrders(keys, new Map(Object.entries(saved)));
  const meta = Object.fromEntries([...orders].map(([k, order]) => [k, { order }]));
  return orderHomeSections(keys, meta, new Set());
}

const ALL_SAVED_EXCEPT_WALL: Record<string, number> = {
  hero: 0,
  ticket_highlight: 1,
  news: 2,
  squad: 3,
  board: 4,
  history: 5,
  membership: 6,
  sponsors: 7,
  shop: 8,
  raffle: 9,
};

describe("lista canônica da home", () => {
  it("tem o mural dos sócios como seção própria, logo antes da seção de sócio", () => {
    expect(HOME_SECTION_KEYS).toContain("member_wall");
    const i = HOME_SECTION_KEYS.indexOf("member_wall");
    expect(HOME_SECTION_KEYS[i + 1]).toBe("membership");
  });
});

describe("ordem padrão do mural: imediatamente antes de membership", () => {
  it("sem nenhuma ordem gravada, a home sai com o mural logo antes da sócio", () => {
    expect(homeOrder({})).toEqual([
      "hero",
      "ticket_highlight",
      "news",
      "squad",
      "board",
      "history",
      "member_wall",
      "membership",
      "sponsors",
      "shop",
      "raffle",
    ]);
  });

  it("com ordens salvas para as demais seções, o mural cai logo antes da sócio (não no fim)", () => {
    const order = homeOrder(ALL_SAVED_EXCEPT_WALL);
    expect(order.indexOf("member_wall")).toBe(order.indexOf("membership") - 1);
    expect(order.indexOf("member_wall")).toBeGreaterThan(order.indexOf("history"));
  });

  it("se a seção de sócio foi movida para o começo, o mural vai junto para logo antes dela", () => {
    const order = homeOrder({ ...ALL_SAVED_EXCEPT_WALL, membership: 0, hero: 1 });
    expect(order[0]).toBe("member_wall");
    expect(order[1]).toBe("membership");
  });

  it("uma ordem gravada para o próprio mural é respeitada (o admin pode arrastá-lo)", () => {
    const order = homeOrder({ ...ALL_SAVED_EXCEPT_WALL, member_wall: 9 });
    expect(order.indexOf("member_wall")).toBe(order.indexOf("raffle") - 1);
    expect(order.indexOf("member_wall")).toBeGreaterThan(order.indexOf("shop"));
  });

  it("sem a seção de sócio na lista, o mural usa a própria posição (não há âncora)", () => {
    const orders = resolveSectionOrders(["hero", "member_wall"], new Map());
    expect(orders.get("member_wall")).toBe(2);
  });
});

describe("resolveSectionOrders", () => {
  it("usa a ordem gravada quando existe e a posição (1-based) quando não existe", () => {
    const orders = resolveSectionOrders(["hero", "news", "membership"], new Map([["news", 7]]));
    expect(orders.get("hero")).toBe(1);
    expect(orders.get("news")).toBe(7);
    expect(orders.get("membership")).toBe(3);
  });

  it("a âncora usa a ordem gravada da seção de sócio, mesmo que ela tenha ordem alta", () => {
    const orders = resolveSectionOrders(
      ["news", "member_wall", "membership"],
      new Map([["membership", 2]]),
    );
    expect(orders.get("member_wall")).toBe(1.5);
  });
});

describe("orderHomeSections", () => {
  it("tira as seções escondidas e ordena pela ordem efetiva, sem mudar a ordem de empates", () => {
    const meta = {
      news: { order: 3 },
      hero: { order: 1 },
      shop: { order: 2 },
    };
    expect(orderHomeSections(["news", "hero", "shop"], meta, new Set(["shop"]))).toEqual(["hero", "news"]);
  });

  it("seção sem metadado vai para o fim", () => {
    expect(orderHomeSections(["x", "hero"], { hero: { order: 1 } }, new Set())).toEqual(["hero", "x"]);
  });
});

describe("savedSectionOrders", () => {
  it("lê só inteiros finitos; vazio, texto e ausência não viram ordem", () => {
    const rows: Record<string, string> = {
      "section.hero.order": "4",
      "section.news.order": "",
      "section.squad.order": "abc",
      "section.board.order": "   ",
    };
    const saved = savedSectionOrders(["hero", "news", "squad", "board", "history"], (k) => rows[k]);
    expect([...saved]).toEqual([["hero", 4]]);
  });
});

describe("rótulo de seção: valor exibido", () => {
  it("resolveSectionLabel devolve o texto trimado quando válido", () => {
    expect(resolveSectionLabel("  Loja Oficial  ")).toBe("Loja Oficial");
  });

  it("resolveSectionLabel devolve vazio para ausente, não-texto ou inválido (nunca lança)", () => {
    for (const raw of [undefined, null, 42, "", "   ", "A", "<b>x</b>", "a".repeat(41), "Loja 🛒"]) {
      expect(resolveSectionLabel(raw)).toBe("");
    }
  });

  it("getSectionLabel: o rótulo do clube vence o padrão; sem rótulo, o padrão", () => {
    const meta = { shop: { label: "Loja Oficial" }, news: { label: "" }, board: {} };
    expect(getSectionLabel(meta, "shop", "Produtos")).toBe("Loja Oficial");
    expect(getSectionLabel(meta, "news", "Fique por Dentro")).toBe("Fique por Dentro");
    expect(getSectionLabel(meta, "board", "Diretoria")).toBe("Diretoria");
    expect(getSectionLabel(meta, "inexistente", "Patrocinadores")).toBe("Patrocinadores");
  });

  it("getSectionLabel com fallback undefined devolve undefined quando não há rótulo", () => {
    expect(getSectionLabel({ news: { label: "" } }, "news", undefined)).toBeUndefined();
    expect(getSectionLabel({ news: { label: "Notícias" } }, "news", undefined)).toBe("Notícias");
  });

  it("getSectionLabel ignora rótulo inválido que tenha chegado sem validação", () => {
    expect(getSectionLabel({ news: { label: "<img src=x>" } }, "news", "Notícias")).toBe("Notícias");
  });
});

describe("rótulo de seção: validação da gravação", () => {
  it("chave do rótulo é section.<key>.label", () => {
    expect(sectionLabelKey("shop")).toBe("section.shop.label");
  });

  it.each(["Loja", "Loja Oficial", "Sócio-Torcedor", "D'Ouro", "Ação", "AB", "a".repeat(40)])(
    "aceita o rótulo %j",
    (label) => {
      expect(isValidSectionLabelText(label)).toBe(true);
      expect(isValidSectionLabelConfigValue("section.shop.label", label)).toBe(true);
    },
  );

  it.each([
    ["1 caractere", "A"],
    ["41 caracteres", "a".repeat(41)],
    ["HTML", "<script>alert(1)</script>"],
    ["aspas", 'Loja "X"'],
    ["emoji", "Loja 🛒"],
    ["quebra de linha", "Loja\nX"],
    ["espaço na borda", " Loja"],
    ["espaço duplo", "Loja  X"],
    ["só dígitos", "1234"],
  ])("recusa %s", (_label, value) => {
    expect(isValidSectionLabelText(value)).toBe(false);
    expect(isValidSectionLabelConfigValue("section.shop.label", value)).toBe(false);
  });

  it("vazio é aceito na gravação (volta ao padrão)", () => {
    expect(isValidSectionLabelConfigValue("section.shop.label", "")).toBe(true);
  });

  it("outras chaves não passam por esta regra", () => {
    expect(isValidSectionLabelConfigValue("section.shop.enabled", "<b>x</b>")).toBe(true);
    expect(isValidSectionLabelConfigValue("siteName", "<b>x</b>")).toBe(true);
  });

  it("a regra genérica respeita o tamanho informado", () => {
    expect(isValidLabelText("Abc", 2, 5)).toBe(true);
    expect(isValidLabelText("A", 2, 5)).toBe(false);
    expect(isValidLabelText("Abcdef", 2, 5)).toBe(false);
    expect(isValidLabelText(42, 2, 5)).toBe(false);
  });
});
