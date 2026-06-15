import { describe, it, expect } from "vitest";
import {
  isPromotionActive,
  computePromotionDiscount,
  isFlashSale,
  flashSaleRemainingMs,
} from "./utils";

const past = new Date("2020-01-01T00:00:00Z");
const future = new Date("2099-01-01T00:00:00Z");
const now = new Date("2026-06-14T12:00:00Z");

const basePromo = {
  discountType: "pct" as const,
  discountValue: 10,
  minOrderCents: 0,
  active: true,
  startsAt: past,
  endsAt: future,
  flashSale: false,
};

describe("isPromotionActive", () => {
  it("returns true for currently active promotion", () => {
    expect(isPromotionActive(basePromo, now)).toBe(true);
  });

  it("returns false when inactive flag is set", () => {
    expect(isPromotionActive({ ...basePromo, active: false }, now)).toBe(false);
  });

  it("returns false when promotion has not started yet", () => {
    expect(isPromotionActive({ ...basePromo, startsAt: future }, now)).toBe(false);
  });

  it("returns false when promotion has already ended", () => {
    expect(isPromotionActive({ ...basePromo, endsAt: past }, now)).toBe(false);
  });

  it("returns true at exact start boundary", () => {
    expect(isPromotionActive({ ...basePromo, startsAt: now, endsAt: future }, now)).toBe(true);
  });

  it("returns true at exact end boundary", () => {
    expect(isPromotionActive({ ...basePromo, startsAt: past, endsAt: now }, now)).toBe(true);
  });
});

describe("computePromotionDiscount — percentage", () => {
  it("computes 10% of 10000 = 1000", () => {
    expect(computePromotionDiscount(10000, { discountType: "pct", discountValue: 10, minOrderCents: 0 })).toBe(1000);
  });

  it("computes 15% of 3990 rounded = 599", () => {
    expect(computePromotionDiscount(3990, { discountType: "pct", discountValue: 15, minOrderCents: 0 })).toBe(599);
  });

  it("caps at 100%", () => {
    expect(computePromotionDiscount(5000, { discountType: "pct", discountValue: 150, minOrderCents: 0 })).toBe(5000);
  });

  it("returns 0 when subtotal is below minOrderCents", () => {
    expect(computePromotionDiscount(999, { discountType: "pct", discountValue: 20, minOrderCents: 1000 })).toBe(0);
  });

  it("applies when subtotal equals minOrderCents", () => {
    expect(computePromotionDiscount(1000, { discountType: "pct", discountValue: 10, minOrderCents: 1000 })).toBe(100);
  });
});

describe("computePromotionDiscount — fixed", () => {
  it("returns fixed amount when subtotal >= discount", () => {
    expect(computePromotionDiscount(5000, { discountType: "fixed", discountValue: 1000, minOrderCents: 0 })).toBe(1000);
  });

  it("caps fixed discount at subtotal", () => {
    expect(computePromotionDiscount(500, { discountType: "fixed", discountValue: 1000, minOrderCents: 0 })).toBe(500);
  });

  it("returns 0 when below minOrderCents", () => {
    expect(computePromotionDiscount(999, { discountType: "fixed", discountValue: 500, minOrderCents: 1000 })).toBe(0);
  });
});

describe("isFlashSale", () => {
  it("returns true for active flash sale", () => {
    expect(isFlashSale({ flashSale: true, endsAt: future }, now)).toBe(true);
  });

  it("returns false when flashSale is false", () => {
    expect(isFlashSale({ flashSale: false, endsAt: future }, now)).toBe(false);
  });

  it("returns false when flash sale has ended", () => {
    expect(isFlashSale({ flashSale: true, endsAt: past }, now)).toBe(false);
  });
});

describe("flashSaleRemainingMs", () => {
  it("returns positive ms when not yet ended", () => {
    const endsAt = new Date(now.getTime() + 3600_000);
    expect(flashSaleRemainingMs(endsAt, now)).toBe(3600_000);
  });

  it("returns 0 when already ended", () => {
    expect(flashSaleRemainingMs(past, now)).toBe(0);
  });
});
