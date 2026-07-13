import { describe, it, expect, beforeEach, vi } from "vitest";

// Redis em memória (hoisted p/ o mock). O OTP não depende mais de canal de envio.
const h = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  const counters = new Map<string, number>();
  const fakeRedis = {
    get: async (k: string) => (store.has(k) ? store.get(k) : null),
    set: async (k: string, v: unknown) => { store.set(k, v); },
    del: async (k: string) => { store.delete(k); counters.delete(k); },
    incr: async (k: string) => { const n = (counters.get(k) ?? 0) + 1; counters.set(k, n); return n; },
    expire: async () => {},
  };
  return { store, counters, fakeRedis, current: { redis: fakeRedis as unknown } };
});

vi.mock("@/lib/redis", () => ({ getRedisOrNull: () => h.current.redis }));

import { issueOtpCode, checkOrdersOtp } from "./otp";

const PHONE = "5567999990000";

describe("orders OTP", () => {
  beforeEach(() => {
    process.env.TICKET_SIGNING_SECRET = "test-secret";
    h.store.clear();
    h.counters.clear();
    h.current.redis = h.fakeRedis;
  });

  it("emite um código de 6 dígitos", async () => {
    const code = await issueOtpCode(PHONE);
    expect(code).toMatch(/^\d{6}$/);
  });

  it("retorna null quando não há Redis (não bloqueia geração em memória externa)", async () => {
    h.current.redis = null;
    expect(await issueOtpCode(PHONE)).toBeNull();
  });

  it("verifica o código correto e o consome (uso único)", async () => {
    const code = (await issueOtpCode(PHONE))!;
    expect(await checkOrdersOtp(PHONE, code)).toBe(true);
    expect(await checkOrdersOtp(PHONE, code)).toBe(false);
  });

  it("rejeita código errado", async () => {
    const code = (await issueOtpCode(PHONE))!;
    const wrong = code === "000000" ? "111111" : "000000";
    expect(await checkOrdersOtp(PHONE, wrong)).toBe(false);
  });

  it("invalida o código após 5 tentativas erradas (anti-brute-force)", async () => {
    const code = (await issueOtpCode(PHONE))!;
    for (let i = 0; i < 5; i++) {
      expect(await checkOrdersOtp(PHONE, "000001")).toBe(false);
    }
    expect(await checkOrdersOtp(PHONE, code)).toBe(false);
  });

  it("retorna false quando não há código armazenado", async () => {
    expect(await checkOrdersOtp(PHONE, "123456")).toBe(false);
  });
});
