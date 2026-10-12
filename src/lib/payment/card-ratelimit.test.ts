import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => {
  const counters = new Map<string, number>();
  const fakeRedis = {
    incr: async (k: string) => { const n = (counters.get(k) ?? 0) + 1; counters.set(k, n); return n; },
    expire: async () => {},
  };
  return { counters, fakeRedis, ip: "203.0.113.10" };
});

vi.mock("@/lib/redis", () => ({ getRedisOrNull: () => h.fakeRedis }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": h.ip }),
}));

import { checkCardAttemptLimit, CARD_ATTEMPT_LIMITS } from "./card-ratelimit";

describe("checkCardAttemptLimit (anti card-testing)", () => {
  beforeEach(() => {
    h.counters.clear();
    h.ip = "203.0.113.10";
  });

  it("permite até o limite por comprador e bloqueia a partir dele", async () => {
    const buyer = { phone: "(11) 99999-0000", email: "Fan@Example.com" };
    for (let i = 0; i < CARD_ATTEMPT_LIMITS.buyer.limit; i++) {
      expect(await checkCardAttemptLimit(buyer)).toBe(true);
    }
    expect(await checkCardAttemptLimit(buyer)).toBe(false);
  });

  it("bloqueia o mesmo comprador mesmo trocando de IP", async () => {
    const buyer = { phone: "11999990000", email: "a@b.com" };
    for (let i = 0; i < CARD_ATTEMPT_LIMITS.buyer.limit; i++) {
      h.ip = `198.51.100.${i}`;
      expect(await checkCardAttemptLimit(buyer)).toBe(true);
    }
    h.ip = "198.51.100.200";
    expect(await checkCardAttemptLimit(buyer)).toBe(false);
  });

  it("normaliza telefone e e-mail (formatação diferente não burla o limite)", async () => {
    for (let i = 0; i < CARD_ATTEMPT_LIMITS.buyer.limit; i++) {
      h.ip = `198.51.100.${i}`;
      await checkCardAttemptLimit({ phone: `1199999000${i}`, email: "fan@example.com" });
    }
    h.ip = "198.51.100.250";
    expect(await checkCardAttemptLimit({ phone: "21988887777", email: "  FAN@example.com " })).toBe(false);
  });

  it("bloqueia o IP que testa muitos compradores diferentes", async () => {
    for (let i = 0; i < CARD_ATTEMPT_LIMITS.ip.limit; i++) {
      expect(await checkCardAttemptLimit({ phone: `1190000000${i}`, email: `b${i}@x.com` })).toBe(true);
    }
    expect(await checkCardAttemptLimit({ phone: "11911112222", email: "novo@x.com" })).toBe(false);
  });

  it("não guarda nada derivado do cartão nas chaves", async () => {
    await checkCardAttemptLimit({ phone: "11999990000", email: "a@b.com" });
    for (const key of h.counters.keys()) {
      expect(key).toMatch(/^rl:card:(ip|ph|em):/);
    }
  });
});
