import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTableName } from "drizzle-orm";

/**
 * Escrita dos planos de sócio: validação explícita (negativos incluídos) e a
 * atomicidade pelo db.batch. O banco é um fake que registra as operações.
 */
const h = vi.hoisted(() => ({
  selects: [] as unknown[][],
  batches: [] as { op: string; table: string; values?: unknown }[][],
}));

vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    throw new Error("NAO_USAR_DB_DIRETO_NOS_TESTES");
  },
}));

import {
  PlanAdminError,
  benefitMatrixSchema,
  patchPlan,
  planBenefitLinksSchema,
  planFieldsSchema,
  replacePlanBenefits,
  saveBenefitMatrix,
  savePlan,
} from "./plan-admin";

const UUID_A = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const UUID_B = "1c7f8b4f-4d2f-4a6b-8e3c-2b3c4d5e6f70";

const VALID = {
  name: "Carcará",
  slug: "carcara",
  description: null,
  priceCents: 4990,
  ticketDiscountPct: 0,
  productDiscountPct: 10,
  freeTicketsPerHomeGame: 1,
  firstMonthFree: false,
  promoEndsAt: null,
  highlightLabel: null,
  cardColor: null,
  highlight: false,
  active: true,
  order: 2,
};

/** Fake de drizzle: cada operação vira um registro; select devolve a fila de `h.selects`. */
function fakeDb() {
  const selectChain = (): unknown => {
    const rows = h.selects.length ? h.selects.shift() : [];
    const chain: Record<string, unknown> = {};
    for (const m of ["from", "where", "limit", "innerJoin", "orderBy"]) chain[m] = () => chain;
    chain.then = (resolve: (v: unknown) => void) => resolve(rows);
    return chain;
  };
  const op = (kind: string, table: unknown) => {
    const self: Record<string, unknown> = { op: kind, table: getTableName(table as Parameters<typeof getTableName>[0]), payload: undefined };
    self.set = (v: unknown) => { self.payload = v; return self; };
    self.values = (v: unknown) => { self.payload = v; return self; };
    self.where = () => self;
    return self;
  };
  return {
    select: selectChain,
    insert: (t: unknown) => op("insert", t),
    update: (t: unknown) => op("update", t),
    delete: (t: unknown) => op("delete", t),
    batch: async (queries: { op: string; table: string; payload?: unknown }[]) => {
      h.batches.push(queries.map((q) => ({ op: q.op, table: q.table, values: q.payload })));
      return queries.map(() => undefined);
    },
  };
}

beforeEach(() => {
  h.selects = [];
  h.batches = [];
});

describe("planFieldsSchema (negativos)", () => {
  it("aceita um plano válido e converte a data-limite para o fim do dia em Brasília", () => {
    const parsed = planFieldsSchema.parse({ ...VALID, firstMonthFree: true, promoEndsAt: "2026-12-31" });
    expect(parsed.promoEndsAt?.toISOString()).toBe("2027-01-01T02:59:59.000Z");
    expect(parsed.cardColor).toBeNull();
  });

  it("rejeita cor fora de #RRGGBB", () => {
    for (const cardColor of ["red", "#fff", "#c19a5a;x", "javascript:alert(1)"]) {
      expect(planFieldsSchema.safeParse({ ...VALID, cardColor }).success, cardColor).toBe(false);
    }
    expect(planFieldsSchema.parse({ ...VALID, cardColor: "#C19A5A" }).cardColor).toBe("#c19a5a");
  });

  it("rejeita percentuais fora de 0–100 e ingressos grátis fora de 0–10", () => {
    expect(planFieldsSchema.safeParse({ ...VALID, productDiscountPct: 101 }).success).toBe(false);
    expect(planFieldsSchema.safeParse({ ...VALID, ticketDiscountPct: -1 }).success).toBe(false);
    expect(planFieldsSchema.safeParse({ ...VALID, ticketDiscountPct: 10.5 }).success).toBe(false);
    expect(planFieldsSchema.safeParse({ ...VALID, freeTicketsPerHomeGame: 11 }).success).toBe(false);
    expect(planFieldsSchema.safeParse({ ...VALID, freeTicketsPerHomeGame: Number.NaN }).success).toBe(false);
    expect(planFieldsSchema.safeParse({ ...VALID, freeTicketsPerHomeGame: 10 }).success).toBe(true);
  });

  it("rejeita data-limite inexistente ou em outro formato", () => {
    expect(planFieldsSchema.safeParse({ ...VALID, promoEndsAt: "2026-02-30" }).success).toBe(false);
    expect(planFieldsSchema.safeParse({ ...VALID, promoEndsAt: "31/12/2026" }).success).toBe(false);
  });

  it("rejeita etiqueta do destaque com mais de 24 caracteres", () => {
    expect(planFieldsSchema.safeParse({ ...VALID, highlightLabel: "x".repeat(25) }).success).toBe(false);
    expect(planFieldsSchema.parse({ ...VALID, highlightLabel: "  " }).highlightLabel).toBeNull();
  });

  it("rejeita slug com maiúsculas, espaços ou barras", () => {
    for (const slug of ["Plano Ouro", "plano/ouro", "-x", "a--b"]) {
      expect(planFieldsSchema.safeParse({ ...VALID, slug }).success, slug).toBe(false);
    }
  });

  it("rejeita preço negativo, fracionado ou acima do limite", () => {
    expect(planFieldsSchema.safeParse({ ...VALID, priceCents: -1 }).success).toBe(false);
    expect(planFieldsSchema.safeParse({ ...VALID, priceCents: 19.9 }).success).toBe(false);
    expect(planFieldsSchema.safeParse({ ...VALID, priceCents: 10_000_001 }).success).toBe(false);
  });

  it("descarta campos que não existem no formulário (sem mass assignment)", () => {
    const parsed = planFieldsSchema.parse({ ...VALID, id: UUID_A, createdAt: "2000-01-01", planId: UUID_B });
    expect(parsed).not.toHaveProperty("id");
    expect(parsed).not.toHaveProperty("createdAt");
    expect(parsed).not.toHaveProperty("planId");
  });
});

describe("benefícios e matriz (negativos)", () => {
  it("rejeita benefício repetido num plano e detalhe acima de 60 caracteres", () => {
    expect(
      planBenefitLinksSchema.safeParse([{ benefitId: UUID_A }, { benefitId: UUID_A }]).success
    ).toBe(false);
    expect(
      planBenefitLinksSchema.safeParse([{ benefitId: UUID_A, detail: "x".repeat(61) }]).success
    ).toBe(false);
    expect(planBenefitLinksSchema.parse([{ benefitId: UUID_A, detail: "  " }])[0].detail).toBeNull();
  });

  it("rejeita id que não é UUID", () => {
    expect(planBenefitLinksSchema.safeParse([{ benefitId: "'; DROP TABLE x;--" }]).success).toBe(false);
  });

  it("rejeita célula de plano que não está na matriz e célula repetida", () => {
    expect(
      benefitMatrixSchema.safeParse({
        planIds: [UUID_A],
        cells: [{ benefitId: UUID_B, planId: UUID_B }],
      }).success
    ).toBe(false);
    expect(
      benefitMatrixSchema.safeParse({
        planIds: [UUID_A],
        cells: [
          { benefitId: UUID_B, planId: UUID_A },
          { benefitId: UUID_B, planId: UUID_A },
        ],
      }).success
    ).toBe(false);
  });
});

describe("savePlan (atômico)", () => {
  it("criar: insere, tira o destaque dos outros e troca os benefícios no MESMO batch", async () => {
    h.selects = [[], [{ id: UUID_B }]]; // slug livre; benefício existe
    const fields = planFieldsSchema.parse({ ...VALID, highlight: true });
    const { id } = await savePlan(fakeDb() as never, null, fields, [{ benefitId: UUID_B, detail: "3 segundos" }]);

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(h.batches).toHaveLength(1);
    const ops = h.batches[0];
    expect(ops.map((o) => `${o.op}:${o.table}`)).toEqual([
      "insert:membership_plans",
      "update:membership_plans",
      "delete:plan_benefits",
      "insert:plan_benefits",
    ]);
    expect(ops[1].values).toEqual({ highlight: false });
    expect(ops[3].values).toEqual([{ planId: id, benefitId: UUID_B, included: true, detail: "3 segundos" }]);
  });

  it("não tira o destaque dos outros quando o plano não é destaque", async () => {
    h.selects = [[]];
    await savePlan(fakeDb() as never, null, planFieldsSchema.parse(VALID));
    expect(h.batches[0].map((o) => o.op)).toEqual(["insert"]);
  });

  it("slug já usado por outro plano: erro de domínio e nada gravado", async () => {
    h.selects = [[{ id: UUID_A }], [{ id: UUID_B }]]; // existe; slug em uso por outro
    await expect(
      savePlan(fakeDb() as never, UUID_A, planFieldsSchema.parse(VALID))
    ).rejects.toThrow(PlanAdminError);
    expect(h.batches).toHaveLength(0);
  });

  it("plano inexistente (edição): erro e nada gravado", async () => {
    h.selects = [[]];
    await expect(savePlan(fakeDb() as never, UUID_A, planFieldsSchema.parse(VALID))).rejects.toThrow(
      "Plano não encontrado."
    );
    expect(h.batches).toHaveLength(0);
  });

  it("benefício inexistente: nada gravado", async () => {
    h.selects = [[], []]; // slug livre; benefício NÃO encontrado
    await expect(
      savePlan(fakeDb() as never, null, planFieldsSchema.parse(VALID), [{ benefitId: UUID_B, detail: null }])
    ).rejects.toThrow(PlanAdminError);
    expect(h.batches).toHaveLength(0);
  });
});

describe("patchPlan (atualização parcial)", () => {
  it("mantém os campos que não vieram e revalida o registro completo", async () => {
    h.selects = [
      [
        {
          id: UUID_A, name: "Raiz", slug: "raiz", icon: "Leaf", description: null, priceCents: 990,
          ticketDiscountPct: 0, productDiscountPct: 5, freeTicketsPerHomeGame: 0, firstMonthFree: false,
          promoEndsAt: null, highlightLabel: null, cardColor: null, highlight: false, active: true, order: 1,
        },
      ],
      [{ id: UUID_A }], // existência revalidada por savePlan
      [], // slug livre
    ];
    await patchPlan(fakeDb() as never, UUID_A, { priceCents: 1990 });
    const update = h.batches[0][0];
    expect(update.op).toBe("update");
    expect(update.values).toMatchObject({ name: "Raiz", icon: "Leaf", priceCents: 1990, productDiscountPct: 5 });
  });
});

describe("replacePlanBenefits e saveBenefitMatrix", () => {
  it("replacePlanBenefits troca só os vínculos do plano", async () => {
    h.selects = [[{ id: UUID_A }], [{ id: UUID_B }]];
    await replacePlanBenefits(fakeDb() as never, UUID_A, [{ benefitId: UUID_B, detail: null }]);
    expect(h.batches[0].map((o) => `${o.op}:${o.table}`)).toEqual([
      "delete:plan_benefits",
      "insert:plan_benefits",
    ]);
  });

  it("saveBenefitMatrix apaga só os planos enviados e insere as células marcadas", async () => {
    h.selects = [[{ id: UUID_A }], [{ id: UUID_B }]];
    await saveBenefitMatrix(fakeDb() as never, {
      planIds: [UUID_A],
      cells: [{ benefitId: UUID_B, planId: UUID_A, detail: "5 min" }],
    });
    expect(h.batches[0].map((o) => `${o.op}:${o.table}`)).toEqual([
      "delete:plan_benefits",
      "insert:plan_benefits",
    ]);
    expect(h.batches[0][1].values).toEqual([
      { planId: UUID_A, benefitId: UUID_B, included: true, detail: "5 min" },
    ]);
  });

  it("matriz com plano inexistente: nada gravado", async () => {
    h.selects = [[]];
    await expect(
      saveBenefitMatrix(fakeDb() as never, { planIds: [UUID_A], cells: [] })
    ).rejects.toThrow(PlanAdminError);
    expect(h.batches).toHaveLength(0);
  });
});
