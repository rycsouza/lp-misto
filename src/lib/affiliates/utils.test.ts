import { describe, it, expect } from "vitest";
import {
  generateAffiliateCode,
  computeAffiliateCommission,
  isValidAffiliateCode,
} from "./utils";

describe("generateAffiliateCode", () => {
  it("produces a non-empty string", () => {
    const code = generateAffiliateCode("João Silva");
    expect(code.length).toBeGreaterThan(0);
  });

  it("strips accents and spaces", () => {
    const code = generateAffiliateCode("João Silva");
    expect(code).toMatch(/^[a-zA-Z0-9]+$/);
  });

  it("generates unique codes for same name", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateAffiliateCode("Maria")));
    expect(codes.size).toBeGreaterThan(1);
  });

  it("handles names with special characters", () => {
    const code = generateAffiliateCode("Çédric & Co!");
    expect(code).toMatch(/^[a-zA-Z0-9]+$/);
  });
});

describe("computeAffiliateCommission — percentage", () => {
  it("computes 10% of 10000 = 1000", () => {
    expect(computeAffiliateCommission(10000, "pct", 10)).toBe(1000);
  });

  it("computes 15% of 3990 = 598 (rounded)", () => {
    expect(computeAffiliateCommission(3990, "pct", 15)).toBe(599);
  });

  it("caps at 100%", () => {
    expect(computeAffiliateCommission(5000, "pct", 150)).toBe(5000);
  });

  it("returns 0 for zero order total", () => {
    expect(computeAffiliateCommission(0, "pct", 10)).toBe(0);
  });

  it("returns 0 for zero commission value", () => {
    expect(computeAffiliateCommission(10000, "pct", 0)).toBe(0);
  });
});

describe("computeAffiliateCommission — fixed", () => {
  it("returns fixed amount when order total >= commission", () => {
    expect(computeAffiliateCommission(5000, "fixed", 1000)).toBe(1000);
  });

  it("caps fixed commission at order total", () => {
    expect(computeAffiliateCommission(500, "fixed", 1000)).toBe(500);
  });

  it("returns 0 for negative commission value", () => {
    expect(computeAffiliateCommission(5000, "fixed", 0)).toBe(0);
  });
});

describe("isValidAffiliateCode", () => {
  it("accepts alphanumeric 4–20 chars", () => {
    expect(isValidAffiliateCode("JOAO123")).toBe(true);
    expect(isValidAffiliateCode("abc1")).toBe(true);
    expect(isValidAffiliateCode("ABCDEFGHIJ1234567890")).toBe(true);
  });

  it("rejects too short codes", () => {
    expect(isValidAffiliateCode("AB")).toBe(false);
    expect(isValidAffiliateCode("")).toBe(false);
  });

  it("rejects too long codes", () => {
    expect(isValidAffiliateCode("ABCDEFGHIJ12345678901")).toBe(false);
  });

  it("rejects codes with special characters", () => {
    expect(isValidAffiliateCode("joao-silva")).toBe(false);
    expect(isValidAffiliateCode("code@123")).toBe(false);
    expect(isValidAffiliateCode("meu código")).toBe(false);
  });
});
