import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => {
  const counters = new Map<string, number>();
  const fakeRedis = {
    incr: async (k: string) => { const n = (counters.get(k) ?? 0) + 1; counters.set(k, n); return n; },
    expire: async () => {},
  };
  return { counters, fakeRedis, current: { redis: fakeRedis as unknown } };
});

vi.mock("@/lib/redis", () => ({ getRedisOrNull: () => h.current.redis }));

import { rateLimit } from "./ratelimit";

describe("rateLimit", () => {
  beforeEach(() => {
    h.counters.clear();
    h.current.redis = h.fakeRedis;
  });

  it("permite até o limite e bloqueia a partir dele", async () => {
    const key = "rl:test";
    expect((await rateLimit(key, 3, 60)).ok).toBe(true);
    expect((await rateLimit(key, 3, 60)).ok).toBe(true);
    expect((await rateLimit(key, 3, 60)).ok).toBe(true);
    expect((await rateLimit(key, 3, 60)).ok).toBe(false);
  });

  it("é fail-open quando o Redis não está configurado", async () => {
    h.current.redis = null;
    const r = await rateLimit("qualquer", 1, 60);
    expect(r.ok).toBe(true);
  });

  it("chaves diferentes têm contadores independentes", async () => {
    expect((await rateLimit("a", 1, 60)).ok).toBe(true);
    expect((await rateLimit("a", 1, 60)).ok).toBe(false);
    expect((await rateLimit("b", 1, 60)).ok).toBe(true);
  });
});
