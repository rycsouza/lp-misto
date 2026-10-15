import { describe, it, expect, beforeEach, vi } from "vitest";

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

import { formatSocioDesde, getWallView, wallDisplayName, WALL_LIMIT } from "./wall";

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
    expect(Object.keys(group.entries[0]).sort()).toEqual(["name", "since"]);
    expect(Object.keys(view).sort()).toEqual(["groups", "total", "truncated"]);
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
      ["cardColor", "memberSince", "nextBillingDate", "planId", "planName", "priceCents", "status", "wallName"].sort()
    );
    for (const forbidden of ["email", "cpf", "whatsapp", "id", "memberCardToken"]) {
      expect(h.projections[0]).not.toHaveProperty(forbidden);
    }
  });

  it("sem sócios no mural → vazio, sem erro", async () => {
    h.results = [[]];
    expect(await getWallView(NOW)).toEqual({ total: 0, groups: [], truncated: false });
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
