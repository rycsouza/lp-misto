import { describe, it, expect } from "vitest";
import {
  MEMBERSHIP_DEFAULT_PLAN_KEY,
  resolveDefaultPlanSlug,
  resolveInitialPlanSlug,
} from "./default-plan";

const CARCARA = { id: "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f", slug: "carcara" };
const VIP = { id: "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f", slug: "vip" };
const PLANS = [CARCARA, VIP];

describe("resolveDefaultPlanSlug", () => {
  it("devolve o slug do padrão quando ele está entre os planos ativos recebidos", () => {
    expect(resolveDefaultPlanSlug(PLANS, VIP.id)).toBe("vip");
  });

  it("padrão inexistente, inativo (ausente da lista pública) ou vazio → null, sem erro", () => {
    expect(resolveDefaultPlanSlug(PLANS, "11111111-2222-4333-8444-555555555555")).toBeNull();
    expect(resolveDefaultPlanSlug([CARCARA], VIP.id)).toBeNull();
    expect(resolveDefaultPlanSlug(PLANS, "")).toBeNull();
    expect(resolveDefaultPlanSlug([], VIP.id)).toBeNull();
  });

  it("valor que não é texto (ausente, número, objeto) → null", () => {
    expect(resolveDefaultPlanSlug(PLANS, undefined)).toBeNull();
    expect(resolveDefaultPlanSlug(PLANS, null)).toBeNull();
    expect(resolveDefaultPlanSlug(PLANS, 42)).toBeNull();
    expect(resolveDefaultPlanSlug(PLANS, { id: VIP.id })).toBeNull();
  });

  it("compara o id exatamente: variação de caixa ou espaço não casa", () => {
    expect(resolveDefaultPlanSlug(PLANS, VIP.id.toUpperCase())).toBeNull();
    expect(resolveDefaultPlanSlug(PLANS, ` ${VIP.id}`)).toBeNull();
  });

  it("não devolve o uuid: só o slug", () => {
    expect(resolveDefaultPlanSlug(PLANS, VIP.id)).not.toBe(VIP.id);
  });
});

describe("resolveInitialPlanSlug (decisão da página de adesão)", () => {
  it("?plano válido vence o plano padrão", () => {
    expect(resolveInitialPlanSlug(PLANS, "carcara", VIP.id)).toBe("carcara");
  });

  it("sem ?plano, usa o padrão", () => {
    expect(resolveInitialPlanSlug(PLANS, undefined, VIP.id)).toBe("vip");
  });

  it("?plano inválido (slug fora da lista) cai no padrão, não no primeiro plano", () => {
    expect(resolveInitialPlanSlug(PLANS, "nao-existe", VIP.id)).toBe("vip");
    expect(resolveInitialPlanSlug(PLANS, "", VIP.id)).toBe("vip");
  });

  it("sem ?plano e sem padrão válido → null (o wizard usa o primeiro plano, como antes)", () => {
    expect(resolveInitialPlanSlug(PLANS, undefined, undefined)).toBeNull();
    expect(resolveInitialPlanSlug(PLANS, undefined, "11111111-2222-4333-8444-555555555555")).toBeNull();
    expect(resolveInitialPlanSlug(PLANS, "nao-existe", "")).toBeNull();
  });

  it("?plano é comparado pelo slug, nunca pelo id do plano", () => {
    expect(resolveInitialPlanSlug(PLANS, CARCARA.id, undefined)).toBeNull();
  });

  it("valor de ?plano que não é texto é ignorado", () => {
    expect(resolveInitialPlanSlug(PLANS, ["carcara"], VIP.id)).toBe("vip");
  });

  it("sem planos públicos, nada é resolvido", () => {
    expect(resolveInitialPlanSlug([], "carcara", VIP.id)).toBeNull();
  });
});

describe("chave de configuração", () => {
  it("é membershipDefaultPlanId", () => {
    expect(MEMBERSHIP_DEFAULT_PLAN_KEY).toBe("membershipDefaultPlanId");
  });
});
