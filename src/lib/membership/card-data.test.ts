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

  it("código curto passa quando tem o formato S-XXXXXXXX; sem ele ou fora do formato vira null", () => {
    const withCode = buildMemberCardData(view(), { qrValue: "q", memberCode: "S-1A2B3C4D", ...CLUB }, NOW);
    expect(withCode.memberCode).toBe("S-1A2B3C4D");

    const without = buildMemberCardData(view(), { qrValue: "q", ...CLUB }, NOW);
    expect(without.memberCode).toBeNull();

    for (const bad of ["S-1a2b3c4d", "S-1A2B3C4", "S-1A2B3C4D%", "<script>", ""]) {
      expect(buildMemberCardData(view(), { qrValue: "q", memberCode: bad, ...CLUB }, NOW).memberCode).toBeNull();
    }
  });

});

describe("buildMemberCardData — fundo da carteirinha (escolhido pelo clube)", () => {
  const BG_URL = "https://res.cloudinary.com/misto-test/image/upload/v1/misto/fundo.png";
  const OPTS = { qrValue: "q", ...CLUB, uploadCloudName: "misto-test" };

  it("sem configuração de fundo, background é null (cartão só com a cor do plano)", () => {
    expect(buildMemberCardData(view(), OPTS, NOW).background).toBeNull();
  });

  it("leva o fundo validado (url, fit, opacidade)", () => {
    const d = buildMemberCardData(
      view(),
      { ...OPTS, cardBackground: { url: BG_URL, fit: "contain", opacity: 40 } },
      NOW
    );
    expect(d.background).toEqual({ url: BG_URL, fit: "contain", opacity: 40, blend: "multiply" });
  });

  it("mescla vem da configuração; sem valor (ou inválido) cai no padrão multiply", () => {
    const withBlend = (blend: unknown) =>
      buildMemberCardData(view(), { ...OPTS, cardBackground: { url: BG_URL, fit: "cover", opacity: 100, blend } }, NOW)
        .background?.blend;
    expect(withBlend("normal")).toBe("normal");
    expect(withBlend("multiply")).toBe("multiply");
    expect(withBlend(undefined)).toBe("multiply");
    expect(withBlend("screen")).toBe("multiply");
  });

  it("a cor do PLANO segue em cardColor mesmo com a cor do clube preenchida (o clube fica separado)", () => {
    const d = buildMemberCardData(view({ cardColor: "#3F6212" }), { ...OPTS, clubColor: "#c19a5a" }, NOW);
    expect(d.cardColor).toBe("#3f6212");
    expect(d.clubColor).toBe("#c19a5a");
  });

  it("URL hostil ou de outro bucket vira null (sem fundo), sem vazar para o cartão", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:image/svg+xml;base64,PHN2Zz4=",
      "http://res.cloudinary.com/misto-test/image/upload/a.png",
      "https://evil.example/a.png",
      "https://res.cloudinary.com/outro/image/upload/a.png",
    ]) {
      const d = buildMemberCardData(view(), { ...OPTS, cardBackground: { url, fit: "cover", opacity: 100 } }, NOW);
      expect(d.background).toBeNull();
    }
  });

  it("lê CLOUDINARY_CLOUD_NAME do ambiente quando não é passado", () => {
    const prev = process.env.CLOUDINARY_CLOUD_NAME;
    process.env.CLOUDINARY_CLOUD_NAME = "misto-test";
    try {
      const d = buildMemberCardData(
        view(),
        { qrValue: "q", ...CLUB, cardBackground: { url: BG_URL, fit: "cover", opacity: 100 } },
        NOW
      );
      expect(d.background?.url).toBe(BG_URL);
    } finally {
      if (prev === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
      else process.env.CLOUDINARY_CLOUD_NAME = prev;
    }
  });

  it("não adiciona dado pessoal: o fundo não traz e-mail, CPF nem telefone", () => {
    const d = buildMemberCardData(
      view(),
      { ...OPTS, cardBackground: { url: BG_URL, fit: "cover", opacity: 100 } },
      NOW
    );
    expect(JSON.stringify(d)).not.toMatch(/@|cpf|telefone|phone/i);
  });
});
