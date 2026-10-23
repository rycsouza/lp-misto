import { describe, it, expect } from "vitest";
import { isValidHeroStatsConfigValue, isValidHeroStatsValue } from "./hero-stats";

describe("isValidHeroStatsValue", () => {
  it("aceita vazio, lista vazia e pares válidos (só número ou só rótulo também)", () => {
    expect(isValidHeroStatsValue("")).toBe(true);
    expect(isValidHeroStatsValue("[]")).toBe(true);
    expect(isValidHeroStatsValue('[{"value":"1993","label":"Fundação"}]')).toBe(true);
    expect(isValidHeroStatsValue('[{"value":"1993","label":""},{"value":"","label":"Três Lagoas/MS"}]')).toBe(true);
  });

  it("aceita até 6 destaques e recusa o 7º", () => {
    const list = (n: number) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ value: String(i), label: "x" })));
    expect(isValidHeroStatsValue(list(6))).toBe(true);
    expect(isValidHeroStatsValue(list(7))).toBe(false);
  });

  it("recusa formato errado, campos extras, tipos errados, texto longo, bordas e controle", () => {
    for (const bad of [
      "x",
      "null",
      "{}",
      '"1993"',
      "[null]",
      "[[]]",
      '[{"value":"1993"}]',
      '[{"value":"1993","label":"Fundação","extra":"x"}]',
      '[{"value":1993,"label":"Fundação"}]',
      '[{"value":"","label":""}]',
      '[{"value":" 1993","label":"Fundação"}]',
      '[{"value":"1993","label":"Linha\\nquebrada"}]',
      `[{"value":"${"9".repeat(31)}","label":"x"}]`,
      `[{"value":"1","label":"${"x".repeat(41)}"}]`,
    ]) {
      expect(isValidHeroStatsValue(bad), bad).toBe(false);
    }
  });
});

describe("isValidHeroStatsConfigValue", () => {
  it("só valida a chave heroStats", () => {
    expect(isValidHeroStatsConfigValue("siteName", "não é json")).toBe(true);
    expect(isValidHeroStatsConfigValue("heroStats", "não é json")).toBe(false);
  });
});
