import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Planos e benefícios de sócio: TODA action é endpoint POST público. Sem o módulo
 * "socios" a guarda barra ANTES do banco (getDb lança se for chamado). Com o
 * módulo, a entrada inválida é recusada antes do banco também.
 */
const UUID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const h = vi.hoisted(() => ({ session: null as unknown, dbUsed: false }));

vi.mock("@/app/actions/admin-auth", () => ({ getAdminSession: async () => h.session }));
vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    h.dbUsed = true;
    throw new Error("DB_ALCANCADO");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import {
  createBenefit,
  createMembershipPlan,
  deleteBenefit,
  deleteMembershipPlan,
  getAdminBenefits,
  getAdminMembershipPlans,
  moveBenefitDown,
  moveBenefitUp,
  renameBenefit,
  saveBenefitMatrix,
  saveMembershipPlan,
  setPlanBenefits,
  toggleMembershipPlanActive,
  updateMembershipPlan,
} from "./admin-growth";

const EDITOR_OUTRO = { role: "editor", permissions: { jogos: true } };
const EDITOR_SOCIOS = { role: "editor", permissions: { socios: true } };

const PLAN = {
  name: "Carcará",
  slug: "carcara",
  priceCents: 4990,
  ticketDiscountPct: 0,
  productDiscountPct: 10,
  freeTicketsPerHomeGame: 1,
  firstMonthFree: false,
  highlight: false,
  active: true,
};

const CALLS: { name: string; fn: () => Promise<unknown> }[] = [
  { name: "getAdminMembershipPlans", fn: () => getAdminMembershipPlans() },
  { name: "getAdminBenefits", fn: () => getAdminBenefits() },
  { name: "createMembershipPlan", fn: () => createMembershipPlan(PLAN) },
  { name: "updateMembershipPlan", fn: () => updateMembershipPlan(UUID, { name: "Outro" }) },
  { name: "saveMembershipPlan", fn: () => saveMembershipPlan(null, PLAN, []) },
  { name: "toggleMembershipPlanActive", fn: () => toggleMembershipPlanActive(UUID, false) },
  { name: "deleteMembershipPlan", fn: () => deleteMembershipPlan(UUID) },
  { name: "createBenefit", fn: () => createBenefit("Carteirinha digital") },
  { name: "renameBenefit", fn: () => renameBenefit(UUID, "Novo nome") },
  { name: "deleteBenefit", fn: () => deleteBenefit(UUID) },
  { name: "moveBenefitUp", fn: () => moveBenefitUp(UUID) },
  { name: "moveBenefitDown", fn: () => moveBenefitDown(UUID) },
  { name: "setPlanBenefits", fn: () => setPlanBenefits(UUID, []) },
  { name: "saveBenefitMatrix", fn: () => saveBenefitMatrix({ planIds: [UUID], cells: [] }) },
];

beforeEach(() => {
  h.session = null;
  h.dbUsed = false;
});

describe("authz das ações de planos e benefícios (módulo 'socios')", () => {
  for (const { name, fn } of CALLS) {
    it(`${name} bloqueia sessão ausente sem tocar no banco`, async () => {
      h.session = null;
      await expect(fn()).rejects.toThrow("Não autorizado");
      expect(h.dbUsed).toBe(false);
    });

    it(`${name} bloqueia editor sem o módulo socios`, async () => {
      h.session = EDITOR_OUTRO;
      await expect(fn()).rejects.toThrow("Não autorizado");
      expect(h.dbUsed).toBe(false);
    });
  }

  it("editor COM o módulo socios passa da guarda (chega ao banco)", async () => {
    h.session = EDITOR_SOCIOS;
    await expect(getAdminMembershipPlans()).rejects.toThrow("DB_ALCANCADO");
    expect(h.dbUsed).toBe(true);
  });
});

describe("entrada inválida é recusada antes do banco (com permissão)", () => {
  beforeEach(() => {
    h.session = EDITOR_SOCIOS;
  });

  it("cor fora de #RRGGBB", async () => {
    const r = await saveMembershipPlan(null, { ...PLAN, cardColor: "javascript:alert(1)" }, []);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Cor inválida (use #RRGGBB)");
    expect(h.dbUsed).toBe(false);
  });

  it("desconto acima de 100% e ingressos grátis acima de 10", async () => {
    expect((await saveMembershipPlan(null, { ...PLAN, productDiscountPct: 101 }, [])).success).toBe(false);
    expect((await saveMembershipPlan(null, { ...PLAN, freeTicketsPerHomeGame: 11 }, [])).success).toBe(false);
    expect(h.dbUsed).toBe(false);
  });

  it("etiqueta do destaque com mais de 24 caracteres", async () => {
    const r = await createMembershipPlan({ ...PLAN, highlightLabel: "x".repeat(25) });
    expect(r.success).toBe(false);
    expect(h.dbUsed).toBe(false);
  });

  it("id de plano que não é UUID", async () => {
    const r = await saveMembershipPlan("1 OR 1=1", PLAN, []);
    expect(r).toEqual({ success: false, error: "Plano inválido." });
    expect(h.dbUsed).toBe(false);
  });

  it("benefício com detalhe acima de 60 caracteres", async () => {
    const r = await saveMembershipPlan(null, PLAN, [{ benefitId: UUID, detail: "x".repeat(61) }]);
    expect(r.success).toBe(false);
    expect(h.dbUsed).toBe(false);
  });

  it("matriz com célula fora dos planos da matriz", async () => {
    const r = await saveBenefitMatrix({
      planIds: [UUID],
      cells: [{ benefitId: UUID, planId: "1c7f8b4f-4d2f-4a6b-8e3c-2b3c4d5e6f70" }],
    });
    expect(r.success).toBe(false);
    expect(h.dbUsed).toBe(false);
  });

  it("nome de benefício vazio", async () => {
    expect((await createBenefit("   ")).success).toBe(false);
    expect((await renameBenefit(UUID, "")).success).toBe(false);
    expect(h.dbUsed).toBe(false);
  });

  it("atualização parcial sem campos", async () => {
    const r = await updateMembershipPlan(UUID, {});
    expect(r).toEqual({ success: false, error: "Nenhum campo para atualizar." });
    expect(h.dbUsed).toBe(false);
  });
});
