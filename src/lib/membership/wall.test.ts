import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Mural dos sócios (consulta interna): só entra quem tem nome no mural E benefício
 * vigente; a projeção do banco traz só o necessário; a saída tem só o nome e a
 * data de adesão (agrupado por plano, maior preço primeiro).
 */
const h = vi.hoisted(() => ({
  results: [] as unknown[][],
  projections: [] as Record<string, unknown>[],
}));

function fakeDb(): unknown {
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, prop) => {
      if (prop === "then") {
        const value = h.results.length ? h.results.shift() : [];
        return (resolve: (v: unknown) => void) => resolve(value);
      }
      return () => chain;
    },
    apply: () => chain,
  });
  return {
    select: (projection: Record<string, unknown>) => {
      h.projections.push(projection);
      return chain;
    },
  };
}

vi.mock("@/lib/db/client", () => ({ getDb: async () => fakeDb() }));

/** Cache de leitura: registra a chave (nome + slug do clube) e roda a consulta direto. */
const q = vi.hoisted(() => ({ tenant: "clube-a", keys: [] as [string, string][] }));
vi.mock("@/lib/db/queries", () => ({
  currentTenantSlug: async () => q.tenant,
  tenantRead: async (key: string, slug: string, fn: () => Promise<unknown>) => {
    q.keys.push([key, slug]);
    return fn();
  },
}));

import {
  formatSocioDesde,
  getHomeWallView,
  getWallView,
  wallCardOrder,
  wallDisplayName,
  wallTiers,
  WALL_LIMIT,
  type WallCard,
} from "./wall";

const NOW = new Date("2026-10-14T12:00:00-03:00");
const FUTURE = new Date("2026-11-14T12:00:00-03:00");
const PAST = new Date("2026-09-14T12:00:00-03:00");
const JOINED = new Date("2026-03-15T12:00:00-03:00");
const ELITE = { planId: "plan-elite", planName: "Elite", priceCents: 7990, cardColor: "#1f3a93" };
const RAIZ = { planId: "plan-raiz", planName: "Raiz", priceCents: 990, cardColor: null };

function row(overrides: Record<string, unknown>) {
  return {
    wallName: "Nome",
    status: "active",
    nextBillingDate: FUTURE,
    memberSince: JOINED,
    ...ELITE,
    ...overrides,
  };
}

beforeEach(() => {
  h.results = [];
  h.projections = [];
  q.tenant = "clube-a";
  q.keys = [];
});

describe("formatSocioDesde", () => {
  it("devolve a data completa em dd/mm/aaaa", () => {
    expect(formatSocioDesde(JOINED)).toBe("15/03/2026");
  });

  it("usa o fuso de São Paulo: 01/04 02h UTC ainda é 31/03 em Brasília", () => {
    expect(formatSocioDesde(new Date("2026-04-01T02:00:00Z"))).toBe("31/03/2026");
  });

  it("virada do dia no fuso de São Paulo (UTC-3)", () => {
    // 31/03 21h em Brasília (= 01/04 00h UTC): ainda é 31/03 no clube.
    expect(formatSocioDesde(new Date("2026-04-01T00:00:00Z"))).toBe("31/03/2026");
    // 01/04 00h em Brasília (= 01/04 03h UTC): já é 01/04 no clube.
    expect(formatSocioDesde(new Date("2026-04-01T03:00:00Z"))).toBe("01/04/2026");
    // 31/12 23h59 em Brasília (= 01/01 02h59 UTC): ainda é 31/12.
    expect(formatSocioDesde(new Date("2027-01-01T02:59:00Z"))).toBe("31/12/2026");
  });

  it("devolve só a data: nunca hora, minuto ou separador ISO", () => {
    const s = formatSocioDesde(JOINED);
    expect(s).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(s).not.toMatch(/\d{2}:\d{2}|T\d{2}|2026-03-15/);
  });
});

describe("getWallView", () => {
  it("só traz quem tem nome no mural e benefício vigente", async () => {
    h.results = [
      [
        row({ wallName: "Zélia", status: "active" }),
        row({ wallName: "Ana", ...RAIZ, status: "active" }),
        row({ wallName: "Sus", status: "suspended" }),
        row({ wallName: "Pend", status: "pending" }),
        row({ wallName: "Cancelado vigente", status: "cancelled", nextBillingDate: FUTURE }),
        row({ wallName: "Cancelado vencido", status: "cancelled", nextBillingDate: PAST }),
        row({ wallName: "   ", status: "active" }),
        row({ wallName: null, status: "active" }),
      ],
    ];
    const view = await getWallView(NOW);
    const names = view.groups.flatMap((g) => g.entries.map((e) => e.name));
    // Nome público curto: primeiro nome + inicial do último sobrenome.
    expect(names.sort()).toEqual(["Ana", "Cancelado V.", "Zélia"].sort());
    expect(view.total).toBe(3);
  });

  it("agrupa por plano do maior preço ao menor e ordena os nomes", async () => {
    h.results = [
      [
        row({ wallName: "Zélia", ...ELITE }),
        row({ wallName: "Ana", ...RAIZ }),
        row({ wallName: "Ana", ...ELITE }),
        row({ wallName: "Álvaro", ...ELITE }),
      ],
    ];
    const view = await getWallView(NOW);
    expect(view.groups.map((g) => g.planName)).toEqual(["Elite", "Raiz"]);
    expect(view.groups[0].entries.map((e) => e.name)).toEqual(["Álvaro", "Ana", "Zélia"]);
    expect(view.groups[1].entries.map((e) => e.name)).toEqual(["Ana"]);
    expect(view.total).toBe(4);
  });

  it("cada nome leva o 'Sócio desde' em dd/mm/aaaa (fuso de São Paulo)", async () => {
    h.results = [
      [
        row({ wallName: "Ana", memberSince: new Date("2025-11-03T12:00:00-03:00") }),
        row({ wallName: "Bia", memberSince: new Date("2026-03-15T12:00:00-03:00") }),
        // 01/04 02h UTC é 31/03 no clube: a data exibida é a do fuso local.
        row({ wallName: "Caio", memberSince: new Date("2026-04-01T02:00:00Z") }),
      ],
    ];
    const view = await getWallView(NOW);
    expect(view.groups[0].entries).toEqual([
      { name: "Ana", since: "03/11/2025" },
      { name: "Bia", since: "15/03/2026" },
      { name: "Caio", since: "31/03/2026" },
    ]);
  });

  it("a cor do plano passa só se for hex válido; cor inválida vira null", async () => {
    h.results = [
      [
        row({ wallName: "Ana", ...ELITE, cardColor: "#1F3A93" }),
        row({ wallName: "Bia", ...RAIZ, planId: "plan-x", planName: "X", priceCents: 100, cardColor: "red;background:url(x)" }),
      ],
    ];
    const view = await getWallView(NOW);
    expect(view.groups.find((g) => g.planName === "Elite")?.cardColor).toBe("#1f3a93");
    expect(view.groups.find((g) => g.planName === "X")?.cardColor).toBeNull();
  });

  it("a saída tem só nome e data: nada de e-mail, telefone, CPF, id ou hora", async () => {
    h.results = [
      [
        row({
          wallName: "Ana",
          email: "ana@example.com",
          cpf: "52998224725",
          whatsapp: "67999998888",
          id: "m-1",
          memberSince: new Date("2026-03-15T12:00:00-03:00"),
        }),
      ],
    ];
    const view = await getWallView(NOW);
    const group = view.groups[0];
    expect(Object.keys(group).sort()).toEqual(["cardColor", "entries", "planId", "planName", "priceCents"]);
    expect(Object.keys(view.cards[0]).sort()).toEqual(["cardColor", "name", "photoUrl", "planName", "since", "tier"]);
    expect(Object.keys(group.entries[0]).sort()).toEqual(["name", "since"]);
    expect(Object.keys(view).sort()).toEqual(["cards", "groups", "total", "truncated"]);
    expect(group.entries[0].since).toBe("15/03/2026");
    const json = JSON.stringify(view);
    expect(json).not.toMatch(/ana@example|52998224725|67999998888|m-1/);
    // Nada de ISO, hora ou timestamp: a data exibida é só dd/mm/aaaa.
    expect(json).not.toMatch(/2026-03-15|T\d{2}:\d{2}|\d{2}:\d{2}/);
  });

  it("a consulta projeta só as colunas necessárias (sem e-mail, CPF, telefone ou id)", async () => {
    h.results = [[]];
    await getWallView(NOW);
    expect(h.projections).toHaveLength(1);
    expect(Object.keys(h.projections[0]).sort()).toEqual(
      ["cardColor", "memberSince", "nextBillingDate", "photoUrl", "planId", "planName", "priceCents", "status", "wallName"].sort()
    );
    for (const forbidden of ["email", "cpf", "whatsapp", "id", "memberCardToken"]) {
      expect(h.projections[0]).not.toHaveProperty(forbidden);
    }
  });

  it("sem sócios no mural → vazio, sem erro", async () => {
    h.results = [[]];
    expect(await getWallView(NOW)).toEqual({ total: 0, groups: [], cards: [], truncated: false });
  });

  it("marca truncated quando a consulta atinge o teto", async () => {
    const many = Array.from({ length: WALL_LIMIT }, (_, i) => row({ wallName: `Sócio ${i}` }));
    h.results = [many];
    const view = await getWallView(NOW);
    expect(view.truncated).toBe(true);
    expect(view.total).toBe(WALL_LIMIT);
  });
});

describe("wallDisplayName (nome público do mural)", () => {
  it("primeiro nome completo + inicial do último sobrenome", () => {
    expect(wallDisplayName("Maria da Silva")).toBe("Maria S.");
    expect(wallDisplayName("  João   Pedro   Souza  ")).toBe("João S.");
    expect(wallDisplayName("ana écio")).toBe("ana É.");
  });
  it("uma palavra só fica como está; vazio vira vazio", () => {
    expect(wallDisplayName("Pelé")).toBe("Pelé");
    expect(wallDisplayName("   ")).toBe("");
  });
});

describe("wallTiers e nível do cartão (hierarquia pelo preço)", () => {
  it("o preço mais alto é o nível 0; cada preço distinto abaixo ganha o próximo", () => {
    const tiers = wallTiers([990, 7990, 3990, 7990]);
    expect(tiers.get(7990)).toBe(0);
    expect(tiers.get(3990)).toBe(1);
    expect(tiers.get(990)).toBe(2);
    expect(tiers.size).toBe(3);
  });

  it("lista vazia não dá níveis", () => {
    expect(wallTiers([]).size).toBe(0);
  });
});

describe("getWallView — nível pelo preço", () => {
  const PLENO = { planId: "plan-pleno", planName: "Pleno", priceCents: 7990, cardColor: null };
  const MEIO = { planId: "plan-meio", planName: "Meio", priceCents: 3990, cardColor: null };

  const tierByName = (cards: WallCard[]) => Object.fromEntries(cards.map((c) => [c.name, c.tier]));

  it("o plano mais caro é o nível 0; os demais descem um nível por preço distinto", async () => {
    h.results = [[row({ wallName: "Ana", ...RAIZ }), row({ wallName: "Bia", ...MEIO }), row({ wallName: "Caio", ...ELITE })]];
    const view = await getWallView(NOW);
    expect(tierByName(view.cards)).toEqual({ Ana: 2, Bia: 1, Caio: 0 });
  });

  it("planos de mesmo preço dividem o nível (empate não cria degrau)", async () => {
    h.results = [[row({ wallName: "Ana", ...ELITE }), row({ wallName: "Bia", ...PLENO }), row({ wallName: "Caio", ...RAIZ })]];
    const view = await getWallView(NOW);
    expect(tierByName(view.cards)).toEqual({ Ana: 0, Bia: 0, Caio: 1 });
  });

  it("um único plano no mural: todos no nível 0", async () => {
    h.results = [[row({ wallName: "Ana", ...MEIO }), row({ wallName: "Bia", ...MEIO })]];
    const view = await getWallView(NOW);
    expect(view.cards.map((c) => c.tier)).toEqual([0, 0]);
  });

  it("o cartão ganha só o nível: nada de preço, id ou contato no card", async () => {
    h.results = [[row({ wallName: "Ana", ...ELITE, email: "ana@example.com", whatsapp: "67999998888" })]];
    const view = await getWallView(NOW);
    expect(Object.keys(view.cards[0]).sort()).toEqual(["cardColor", "name", "photoUrl", "planName", "since", "tier"]);
    expect(JSON.stringify(view.cards)).not.toMatch(/priceCents|ana@example|67999998888/);
  });
});

describe("getWallView — cards com foto (carrossel único)", () => {
  const CLOUD = "misto-test";
  const PHOTO = `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,g_face,w_512,h_512,q_auto,f_auto/clube-a/socios/fotos/abc123`;

  beforeEach(() => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", CLOUD);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("um card por sócio do mural, com plano e cor do plano", async () => {
    h.results = [
      [
        row({ wallName: "Ana", ...ELITE, photoUrl: PHOTO }),
        row({ wallName: "Bia", ...RAIZ, photoUrl: null }),
        row({ wallName: "Caio", status: "suspended", ...ELITE }),
      ],
    ];
    const view = await getWallView(NOW);
    expect(view.cards).toHaveLength(2);
    expect(view.cards.map((c) => c.planName).sort()).toEqual(["Elite", "Raiz"]);
    const ana = view.cards.find((c) => c.name === "Ana");
    expect(ana).toEqual({
      name: "Ana",
      since: "15/03/2026",
      planName: "Elite",
      cardColor: "#1f3a93",
      photoUrl: PHOTO,
      tier: 0,
    });
  });

  it("a foto só passa se for a URL de entrega do Cloudinary do projeto; o resto vira null", async () => {
    const recusadas = [
      "https://evil.test/x.png",
      `https://res.cloudinary.com/outro-cloud/image/upload/c_fill,g_face,w_512,h_512,q_auto,f_auto/clube-a/socios/fotos/abc`,
      `http://res.cloudinary.com/${CLOUD}/image/upload/c_fill,g_face,w_512,h_512,q_auto,f_auto/clube-a/socios/fotos/abc`,
      `${PHOTO}?x=1`,
      "javascript:alert(1)",
    ];
    h.results = [recusadas.map((photo, i) => row({ wallName: `Sócio ${i}`, photoUrl: photo }))];
    const view = await getWallView(NOW);
    expect(view.cards).toHaveLength(recusadas.length);
    expect(view.cards.every((c) => c.photoUrl === null)).toBe(true);
  });

  it("sem CLOUDINARY_CLOUD_NAME no ambiente, nenhuma foto é exibida", async () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "");
    h.results = [[row({ wallName: "Ana", photoUrl: PHOTO })]];
    const view = await getWallView(NOW);
    expect(view.cards[0].photoUrl).toBeNull();
  });

  it("a lista única respeita o opt-in e o benefício vigente", async () => {
    h.results = [
      [
        row({ wallName: "Ana", status: "active" }),
        row({ wallName: "Vencido", status: "cancelled", nextBillingDate: PAST }),
        row({ wallName: "Pendente", status: "pending" }),
        row({ wallName: null, status: "active" }),
      ],
    ];
    const view = await getWallView(NOW);
    expect(view.cards.map((c) => c.name)).toEqual(["Ana"]);
  });

  it("os cards não trazem id, e-mail, telefone, CPF nem o public_id da foto", async () => {
    h.results = [
      [row({ wallName: "Ana", photoUrl: PHOTO, id: "m-1", email: "ana@example.com", cpf: "52998224725", whatsapp: "67999998888" })],
    ];
    const json = JSON.stringify((await getWallView(NOW)).cards);
    expect(json).not.toMatch(/m-1|ana@example|52998224725|67999998888|publicId|public_id/);
  });

  it("a ordem muda de um dia para o outro, mas é a mesma no mesmo dia", async () => {
    const cards: WallCard[] = Array.from({ length: 12 }, (_, i) => ({
      name: `Sócio ${i}`,
      since: "15/03/2026",
      planName: i % 2 ? "Elite" : "Raiz",
      cardColor: null,
      photoUrl: null,
      tier: i % 2 ? 0 : 1,
    }));
    const dia1 = wallCardOrder(cards, "2026-10-21").map((c) => c.name);
    const dia1Again = wallCardOrder([...cards].reverse(), "2026-10-21").map((c) => c.name);
    const dia2 = wallCardOrder(cards, "2026-10-22").map((c) => c.name);
    expect(dia1Again).toEqual(dia1);
    expect(dia2).not.toEqual(dia1);
    expect([...dia1].sort()).toEqual(cards.map((c) => c.name).sort());
  });

  it("os planos se misturam: não ficam todos de um plano seguido do outro", async () => {
    const cards: WallCard[] = Array.from({ length: 12 }, (_, i) => ({
      name: `Sócio ${String.fromCharCode(65 + i)}`,
      since: "15/03/2026",
      planName: i < 6 ? "Elite" : "Raiz",
      cardColor: null,
      photoUrl: null,
      tier: i < 6 ? 0 : 1,
    }));
    const plans = wallCardOrder(cards, "2026-10-21").map((c) => c.planName);
    const changes = plans.slice(1).filter((p, i) => p !== plans[i]).length;
    expect(changes).toBeGreaterThan(2);
  });

  it("a data do dia usa o fuso de São Paulo (01/04 02h UTC ainda é 31/03 no clube)", async () => {
    const many = () => Array.from({ length: 8 }, (_, i) => row({ wallName: `Sócio ${i}` }));
    h.results = [many()];
    const utcLate = (await getWallView(new Date("2026-04-01T02:00:00Z"))).cards.map((c) => c.name);
    h.results = [many()];
    const brazil31 = (await getWallView(new Date("2026-03-31T12:00:00-03:00"))).cards.map((c) => c.name);
    h.results = [many()];
    const brazil01 = (await getWallView(new Date("2026-04-01T12:00:00-03:00"))).cards.map((c) => c.name);
    expect(utcLate).toEqual(brazil31);
    expect(brazil01).not.toEqual(brazil31);
  });
});

describe("getHomeWallView (mural da home: cache de leitura por clube)", () => {
  it("usa a chave de cache com o slug do clube atual, sem cache compartilhado", async () => {
    h.results = [[row({ wallName: "Ana" })]];
    const view = await getHomeWallView();
    expect(q.keys).toEqual([["getHomeWallView", "clube-a"]]);
    expect(view.total).toBe(1);
    expect(view.cards.map((c) => c.name)).toEqual(["Ana"]);
  });

  it("clubes diferentes têm chaves diferentes (um clube nunca lê o cache de outro)", async () => {
    h.results = [[row({ wallName: "Ana" })]];
    await getHomeWallView();
    q.tenant = "clube-b";
    h.results = [[row({ wallName: "Bia" })]];
    const view = await getHomeWallView();
    expect(q.keys.map(([, slug]) => slug)).toEqual(["clube-a", "clube-b"]);
    expect(view.cards.map((c) => c.name)).toEqual(["Bia"]);
  });

  it("a saída tem a mesma forma de getWallView (só nome, data, plano, cor e nível)", async () => {
    h.results = [[row({ wallName: "Ana" })]];
    const view = await getHomeWallView();
    expect(Object.keys(view.cards[0]).sort()).toEqual(["cardColor", "name", "photoUrl", "planName", "since", "tier"]);
  });

  it("sem sócios no mural: devolve vazio (a home não mostra o bloco)", async () => {
    h.results = [];
    await expect(getHomeWallView()).resolves.toMatchObject({ total: 0, cards: [] });
  });
});
