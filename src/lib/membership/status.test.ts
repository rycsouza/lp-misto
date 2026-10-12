import { describe, it, expect } from "vitest";
import { memberHasBenefits, isPastGrace, parseGatewayDate, OVERDUE_GRACE_DAYS } from "./status";

const NOW = new Date("2026-10-12T15:00:00-03:00");

describe("memberHasBenefits", () => {
  it("ativo → sim", () => expect(memberHasBenefits({ status: "active", nextBillingDate: null }, NOW)).toBe(true));
  it("pendente/suspenso → não", () => {
    expect(memberHasBenefits({ status: "pending", nextBillingDate: null }, NOW)).toBe(false);
    expect(memberHasBenefits({ status: "suspended", nextBillingDate: new Date("2026-12-01") }, NOW)).toBe(false);
  });
  it("cancelado dentro do período pago → sim; depois → não", () => {
    expect(memberHasBenefits({ status: "cancelled", nextBillingDate: new Date("2026-10-20") }, NOW)).toBe(true);
    expect(memberHasBenefits({ status: "cancelled", nextBillingDate: new Date("2026-10-01") }, NOW)).toBe(false);
    expect(memberHasBenefits({ status: "cancelled", nextBillingDate: null }, NOW)).toBe(false);
  });
});

describe("isPastGrace", () => {
  it(`carência de ${OVERDUE_GRACE_DAYS} dias conta a partir do fim do dia do vencimento`, () => {
    expect(isPastGrace("2026-10-07", NOW)).toBe(false); // 4,x dias
    expect(isPastGrace("2026-10-06", NOW)).toBe(true); // 5,x dias
  });
  it("sem vencido ou data inválida → não", () => {
    expect(isPastGrace(null, NOW)).toBe(false);
    expect(isPastGrace("lixo", NOW)).toBe(false);
  });
});

describe("parseGatewayDate", () => {
  it("AAAA-MM-DD → mesmo dia em Brasília; formato inválido → null", () => {
    expect(parseGatewayDate("2026-11-12")?.toISOString()).toBe("2026-11-12T15:00:00.000Z");
    expect(parseGatewayDate("12/11/2026")).toBeNull();
    expect(parseGatewayDate(null)).toBeNull();
  });
});
