import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Mural dos sócios (consulta interna): só entra quem tem nome no mural E benefício
 * vigente; a projeção do banco traz só o necessário; a saída tem só o nome (agrupado
 * por plano, maior preço primeiro).
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

import { getWallView, WALL_LIMIT } from "./wall";

const NOW = new Date("2026-10-14T12:00:00-03:00");
const FUTURE = new Date("2026-11-14T12:00:00-03:00");
const PAST = new Date("2026-09-14T12:00:00-03:00");
const ELITE = { planId: "plan-elite", planName: "Elite", priceCents: 7990 };
const RAIZ = { planId: "plan-raiz", planName: "Raiz", priceCents: 990 };

function row(overrides: Record<string, unknown>) {
  return {
    wallName: "Nome",
    status: "active",
    nextBillingDate: FUTURE,
    ...ELITE,
    ...overrides,
  };
}

beforeEach(() => {
  h.results = [];
  h.projections = [];
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
    const names = view.groups.flatMap((g) => g.names);
    expect(names.sort()).toEqual(["Ana", "Cancelado vigente", "Zélia"].sort());
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
    expect(view.groups[0].names).toEqual(["Álvaro", "Ana", "Zélia"]);
    expect(view.groups[1].names).toEqual(["Ana"]);
    expect(view.total).toBe(4);
  });

  it("a saída tem só o nome e dados do plano: nada de e-mail, telefone, CPF ou id do sócio", async () => {
    h.results = [[row({ wallName: "Ana", email: "ana@example.com", cpf: "52998224725", whatsapp: "67999998888", id: "m-1" })]];
    const view = await getWallView(NOW);
    const group = view.groups[0];
    expect(Object.keys(group).sort()).toEqual(["names", "planId", "planName", "priceCents"]);
    expect(Object.keys(view).sort()).toEqual(["groups", "total", "truncated"]);
    expect(JSON.stringify(view)).not.toMatch(/ana@example|52998224725|67999998888|m-1/);
  });

  it("a consulta projeta só as colunas necessárias (sem e-mail, CPF, telefone ou id)", async () => {
    h.results = [[]];
    await getWallView(NOW);
    expect(h.projections).toHaveLength(1);
    expect(Object.keys(h.projections[0]).sort()).toEqual(
      ["nextBillingDate", "planId", "planName", "priceCents", "status", "wallName"].sort()
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
