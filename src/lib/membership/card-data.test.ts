import { describe, it, expect } from "vitest";
import { buildMemberCardData } from "./card-data";
import type { MemberCardView } from "./card";

const NOW = new Date("2026-10-14T12:00:00-03:00");
const FUTURE = new Date("2026-11-10T12:00:00-03:00");
const PAST = new Date("2026-09-10T12:00:00-03:00");

function view(over: Partial<MemberCardView> = {}): MemberCardView {
  return {
    memberId: "m-1",
    name: "Ana Torcedora",
    planName: "Carcará",
    status: "active",
    memberSince: new Date("2026-03-01T12:00:00-03:00"),
    nextBillingDate: FUTURE,
    cancelledAt: null,
    ticketDiscountPct: 0,
    productDiscountPct: 10,
    freeTicketsPerHomeGame: 1,
    cardColor: "#1e3a8a",
    benefits: [{ id: "b1", label: "Treino aberto", detail: null }, { id: "b2", label: "Feijoada", detail: "2 por ano" }],
    ...over,
  };
}

const CLUB = { clubColor: "#c19a5a", clubLogoUrl: "https://cdn.exemplo.com.br/logo.png" };

describe("buildMemberCardData", () => {
  it("copia nome, plano, situação e datas em ISO", () => {
    const d = buildMemberCardData(view(), { qrValue: "https://app/x?token=1", ...CLUB }, NOW);
    expect(d).toMatchObject({
      name: "Ana Torcedora",
      planName: "Carcará",
      status: "active",
      memberSince: "2026-03-01T15:00:00.000Z",
      nextBillingDate: FUTURE.toISOString(),
      cardColor: "#1e3a8a",
      clubColor: "#c19a5a",
      clubLogoUrl: "https://cdn.exemplo.com.br/logo.png",
      qrValue: "https://app/x?token=1",
    });
  });

  it("benefícios automáticos vêm antes e o detalhe entra no texto", () => {
    const d = buildMemberCardData(view(), { qrValue: "q", ...CLUB }, NOW);
    expect(d.benefits.map((b) => b.text)).toEqual([
      "10% de desconto em produtos",
      "1 ingresso grátis por jogo em casa",
      "Treino aberto",
      "Feijoada: 2 por ano",
    ]);
    expect(d.hasDiscounts).toBe(true);
  });

  it("hasBenefits segue a regra da situação (em dia sim; pendente, suspenso e cancelado vencido não)", () => {
    const opts = { qrValue: "q", ...CLUB };
    expect(buildMemberCardData(view({ status: "active" }), opts, NOW).hasBenefits).toBe(true);
    expect(buildMemberCardData(view({ status: "pending" }), opts, NOW).hasBenefits).toBe(false);
    expect(buildMemberCardData(view({ status: "suspended" }), opts, NOW).hasBenefits).toBe(false);
    expect(buildMemberCardData(view({ status: "cancelled", nextBillingDate: FUTURE }), opts, NOW).hasBenefits).toBe(true);
    expect(buildMemberCardData(view({ status: "cancelled", nextBillingDate: PAST }), opts, NOW).hasBenefits).toBe(false);
  });

  it("cor do plano inválida vira null; cor e logo do clube inválidos também", () => {
    const d = buildMemberCardData(
      view({ cardColor: null }),
      { qrValue: "q", clubColor: "javascript:1", clubLogoUrl: "javascript:alert(1)" },
      NOW
    );
    expect(d.cardColor).toBeNull();
    expect(d.clubColor).toBeNull();
    expect(d.clubLogoUrl).toBeNull();
  });

  it("sem desconto, hasDiscounts é falso", () => {
    const d = buildMemberCardData(view({ productDiscountPct: 0, ticketDiscountPct: 0 }), { qrValue: "q", ...CLUB }, NOW);
    expect(d.hasDiscounts).toBe(false);
  });

  it("não copia campos pessoais, mesmo que venham no objeto de entrada", () => {
    const leaky = { ...view(), email: "ana@exemplo.com", cpf: "52998224725", phone: "11900000000", whatsapp: "11900000000" };
    const d = buildMemberCardData(leaky as MemberCardView, { qrValue: "q", ...CLUB }, NOW);
    const json = JSON.stringify(d);
    expect(json).not.toContain("ana@exemplo.com");
    expect(json).not.toContain("52998224725");
    expect(json).not.toContain("11900000000");
    for (const key of ["email", "cpf", "phone", "whatsapp"]) expect(d).not.toHaveProperty(key);
  });
});
