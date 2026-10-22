import { describe, expect, it } from "vitest";
import {
  PLAN_GROUP_SUBTITLE,
  PLAN_GROUP_TITLE,
  groupPlansByAudience,
  isPlanAudience,
} from "./plan-audience";

describe("isPlanAudience", () => {
  it("aceita só pf e pj", () => {
    expect(isPlanAudience("pf")).toBe(true);
    expect(isPlanAudience("pj")).toBe(true);
    expect(isPlanAudience("PJ")).toBe(false);
    expect(isPlanAudience("cnpj")).toBe(false);
    expect(isPlanAudience("")).toBe(false);
    expect(isPlanAudience(undefined)).toBe(false);
    expect(isPlanAudience(null)).toBe(false);
  });
});

describe("groupPlansByAudience", () => {
  it("separa pf e pj mantendo a ordem recebida", () => {
    const plans = [
      { id: "a", audience: "pf" as const },
      { id: "b", audience: "pj" as const },
      { id: "c", audience: "pf" as const },
    ];
    const groups = groupPlansByAudience(plans);
    expect(groups.pf.map((p) => p.id)).toEqual(["a", "c"]);
    expect(groups.pj.map((p) => p.id)).toEqual(["b"]);
  });

  it("grupo sem planos vem vazio (sem título)", () => {
    const groups = groupPlansByAudience([{ id: "a", audience: "pj" as const }]);
    expect(groups.pf).toEqual([]);
    expect(groups.pj).toHaveLength(1);
  });

  it("textos fixos: título e subtítulo da seção empresarial", () => {
    expect(PLAN_GROUP_TITLE.pf).toBe("Planos para você");
    expect(PLAN_GROUP_TITLE.pj).toBe("Planos para empresas");
    expect(PLAN_GROUP_SUBTITLE.pj).toBe("Para CNPJ: divulgação da marca e benefícios para a empresa");
    expect(PLAN_GROUP_SUBTITLE.pf).toBeNull();
  });
});
