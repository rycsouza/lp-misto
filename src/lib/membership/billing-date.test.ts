import { describe, it, expect } from "vitest";
import { addOneMonthBrasilia } from "./billing-date";

describe("addOneMonthBrasilia", () => {
  it("mesmo dia do mês seguinte", () => {
    expect(addOneMonthBrasilia("2026-10-14")).toBe("2026-11-14");
  });

  it("31/01 → 28/02 (ano comum) e 29/02 em ano bissexto", () => {
    expect(addOneMonthBrasilia("2026-01-31")).toBe("2026-02-28");
    expect(addOneMonthBrasilia("2028-01-31")).toBe("2028-02-29");
  });

  it("29/02 (bissexto) → 29/03", () => {
    expect(addOneMonthBrasilia("2028-02-29")).toBe("2028-03-29");
  });

  it("31/12 → 31/01 do ano seguinte", () => {
    expect(addOneMonthBrasilia("2026-12-31")).toBe("2027-01-31");
  });

  it("30 de abril → 30 de maio (dia que existe)", () => {
    expect(addOneMonthBrasilia("2026-04-30")).toBe("2026-05-30");
  });

  it("rejeita data fora do formato AAAA-MM-DD", () => {
    expect(() => addOneMonthBrasilia("14/10/2026")).toThrow();
    expect(() => addOneMonthBrasilia("2026-10-14T00:00:00Z")).toThrow();
  });
});
