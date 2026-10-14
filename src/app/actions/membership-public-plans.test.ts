import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Vitrine pública de planos: devolve só o que a página precisa. Promoção vencida
 * não aparece como ativa, cor inválida no banco não vai para o estilo, e nada de
 * datas internas (createdAt/updatedAt/active) sai no payload.
 */
const h = vi.hoisted(() => ({ results: [] as unknown[][] }));

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
  return { select: () => chain };
}

vi.mock("@/lib/db/client", () => ({ getDb: async () => fakeDb() }));
vi.mock("@/lib/db/queries", () => ({
  currentTenantSlug: async () => "clube-a",
  tenantRead: async (_key: string, _slug: string, fn: () => Promise<unknown>) => fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { getPublicMembershipPlans } from "./membership";

const PLAN_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const FUTURE = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

function planRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    name: "Carcará",
    slug: "carcara",
    icon: "Bird",
    description: null,
    priceCents: 4990,
    ticketDiscountPct: 0,
    productDiscountPct: 10,
    freeTicketsPerHomeGame: 1,
    highlight: true,
    highlightLabel: "  ",
    cardColor: "#C19A5A",
    firstMonthFree: false,
    promoEndsAt: null,
    active: true,
    order: 1,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

beforeEach(() => {
  h.results = [];
});

describe("getPublicMembershipPlans", () => {
  it("promoção vigente sem data-limite: ativa, sem data", async () => {
    h.results = [[planRow({ firstMonthFree: true })], []];
    const [plan] = await getPublicMembershipPlans();
    expect(plan.promoFirstMonthFree).toBe(true);
    expect(plan.promoEndsAt).toBeNull();
  });

  it("promoção com data-limite futura: ativa e devolve o fim em ISO", async () => {
    h.results = [[planRow({ firstMonthFree: true, promoEndsAt: FUTURE })], []];
    const [plan] = await getPublicMembershipPlans();
    expect(plan.promoFirstMonthFree).toBe(true);
    expect(plan.promoEndsAt).toBe(FUTURE.toISOString());
  });

  it("promoção vencida não aparece como ativa", async () => {
    h.results = [[planRow({ firstMonthFree: true, promoEndsAt: PAST })], []];
    const [plan] = await getPublicMembershipPlans();
    expect(plan.promoFirstMonthFree).toBe(false);
    expect(plan.promoEndsAt).toBeNull();
  });

  it("cor só passa se for #RRGGBB (normalizada); etiqueta vazia vira null", async () => {
    h.results = [[planRow({ cardColor: "#C19A5A" })], []];
    expect((await getPublicMembershipPlans())[0].cardColor).toBe("#c19a5a");

    h.results = [[planRow({ cardColor: "red;background:url(x)" })], []];
    const [plan] = await getPublicMembershipPlans();
    expect(plan.cardColor).toBeNull();
    expect(plan.highlightLabel).toBeNull();
  });

  it("benefícios levam o detalhe e o payload não expõe campos internos", async () => {
    h.results = [
      [planRow()],
      [
        { planId: PLAN_ID, benefitId: "b1", label: "Nome no painel de LED", order: 0, detail: "3 segundos" },
      ],
    ];
    const [plan] = await getPublicMembershipPlans();
    expect(plan.benefits).toEqual([{ id: "b1", label: "Nome no painel de LED", order: 0, detail: "3 segundos" }]);
    expect(Object.keys(plan).sort()).toEqual(
      [
        "benefits", "cardColor", "description", "freeTicketsPerHomeGame", "highlight", "highlightLabel",
        "icon", "id", "name", "priceCents", "productDiscountPct", "promoEndsAt", "promoFirstMonthFree",
        "slug", "ticketDiscountPct",
      ].sort()
    );
  });

  it("sem planos ativos devolve lista vazia", async () => {
    h.results = [[]];
    expect(await getPublicMembershipPlans()).toEqual([]);
  });
});
