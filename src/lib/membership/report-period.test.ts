import { describe, it, expect } from "vitest";
import { resolveMembershipPeriod } from "./report-period";

const TODAY = "2026-10-17";

describe("resolveMembershipPeriod", () => {
  it("padrão: do dia 1 do mês atual até hoje (Brasília)", () => {
    const p = resolveMembershipPeriod({}, TODAY);
    expect(p.from).toBe("2026-10-01");
    expect(p.to).toBe("2026-10-17");
    expect(p.start).toEqual(new Date("2026-10-01T00:00:00-03:00"));
    expect(p.endExclusive).toEqual(new Date("2026-10-18T00:00:00-03:00"));
  });

  it("só 'de' → 'até' é hoje", () => {
    expect(resolveMembershipPeriod({ from: "2026-09-05" }, TODAY).to).toBe(TODAY);
  });

  it("entrada ausente ou vazia usa o padrão", () => {
    expect(resolveMembershipPeriod(undefined, TODAY).from).toBe("2026-10-01");
  });

  it("recusa campo extra (entrada estrita)", () => {
    expect(() => resolveMembershipPeriod({ from: "2026-10-01", x: 1 }, TODAY)).toThrow("Período inválido.");
  });

  it("recusa formato errado e datas que não existem", () => {
    expect(() => resolveMembershipPeriod({ from: "01/10/2026" }, TODAY)).toThrow("Período inválido.");
    expect(() => resolveMembershipPeriod({ from: "2026-02-30" }, TODAY)).toThrow("Período inválido.");
    expect(() => resolveMembershipPeriod({ to: "2026-13-01" }, TODAY)).toThrow("Período inválido.");
  });

  it("recusa 'de' depois de 'até'", () => {
    expect(() => resolveMembershipPeriod({ from: "2026-10-10", to: "2026-10-01" }, TODAY)).toThrow("Período inválido.");
  });

  it("recusa intervalo acima de 400 dias", () => {
    expect(() => resolveMembershipPeriod({ from: "2024-01-01", to: "2026-10-01" }, TODAY)).toThrow("400 dias");
  });
});
