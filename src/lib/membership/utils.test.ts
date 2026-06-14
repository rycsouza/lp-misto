import { describe, it, expect } from "vitest";
import {
  validateCPF,
  normalizeCPF,
  formatCPF,
  computeMemberDiscount,
  formatPriceBRL,
  generateMemberCardToken,
  normalizePhone,
} from "./utils";

describe("validateCPF", () => {
  it("accepts valid CPFs", () => {
    expect(validateCPF("529.982.247-25")).toBe(true);
    expect(validateCPF("52998224725")).toBe(true);
    expect(validateCPF("111.444.777-35")).toBe(true);
  });

  it("rejects all-same-digit CPFs", () => {
    expect(validateCPF("111.111.111-11")).toBe(false);
    expect(validateCPF("00000000000")).toBe(false);
    expect(validateCPF("99999999999")).toBe(false);
  });

  it("rejects wrong check digits", () => {
    expect(validateCPF("529.982.247-26")).toBe(false);
    expect(validateCPF("529.982.247-00")).toBe(false);
  });

  it("rejects CPFs with wrong length", () => {
    expect(validateCPF("123")).toBe(false);
    expect(validateCPF("")).toBe(false);
    expect(validateCPF("123456789012")).toBe(false);
  });
});

describe("normalizeCPF", () => {
  it("strips non-digits", () => {
    expect(normalizeCPF("529.982.247-25")).toBe("52998224725");
    expect(normalizeCPF("529 982 247 25")).toBe("52998224725");
  });
});

describe("formatCPF", () => {
  it("formats an 11-digit CPF", () => {
    expect(formatCPF("52998224725")).toBe("529.982.247-25");
  });

  it("passes through invalid input unchanged", () => {
    expect(formatCPF("123")).toBe("123");
  });
});

describe("computeMemberDiscount", () => {
  it("computes 10% of 10000 cents = 1000 cents", () => {
    expect(computeMemberDiscount(10000, 10)).toBe(1000);
  });

  it("computes 15% of 3990 cents = 598 cents (rounded)", () => {
    expect(computeMemberDiscount(3990, 15)).toBe(599);
  });

  it("returns 0 for 0% discount", () => {
    expect(computeMemberDiscount(10000, 0)).toBe(0);
  });

  it("returns 0 for 0 base price", () => {
    expect(computeMemberDiscount(0, 10)).toBe(0);
  });

  it("caps discount at 100%", () => {
    expect(computeMemberDiscount(5000, 150)).toBe(5000);
  });

  it("does not return negative", () => {
    expect(computeMemberDiscount(100, -10)).toBe(0);
  });
});

describe("formatPriceBRL", () => {
  it("formats cents to BRL currency string", () => {
    expect(formatPriceBRL(3990)).toContain("39");
    expect(formatPriceBRL(3990)).toContain("90");
  });

  it("formats 0 cents", () => {
    expect(formatPriceBRL(0)).toContain("0");
  });
});

describe("generateMemberCardToken", () => {
  it("returns a UUID-like string", () => {
    const token = generateMemberCardToken();
    expect(token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 10 }, generateMemberCardToken));
    expect(tokens.size).toBe(10);
  });
});

describe("normalizePhone", () => {
  it("prepends 55 if not present", () => {
    expect(normalizePhone("67999990000")).toBe("5567999990000");
  });

  it("keeps 55 prefix if already present", () => {
    expect(normalizePhone("5567999990000")).toBe("5567999990000");
  });

  it("strips non-digits", () => {
    expect(normalizePhone("(67) 99999-0000")).toBe("5567999990000");
  });
});
