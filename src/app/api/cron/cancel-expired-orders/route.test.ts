import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Cron de expiração: sem CRON_SECRET configurado NÃO pode aceitar
 * "Bearer undefined" (o template viraria esse literal) — fail-closed.
 */
const h = vi.hoisted(() => ({ dbCalls: 0 }));

vi.mock("@/lib/db/platform/client", () => ({
  getPlatformDb: () => {
    h.dbCalls++;
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "from", "innerJoin"]) chain[m] = () => chain;
    chain.where = async () => [];
    return chain;
  },
}));

import { GET } from "./route";

const req = (auth?: string) =>
  new Request("https://app.example.test/api/cron/cancel-expired-orders", {
    headers: auth ? { authorization: auth } : {},
  });

beforeEach(() => {
  h.dbCalls = 0;
  vi.unstubAllEnvs();
  vi.stubEnv("INTERNAL_CRON_SECRET", "internal-test");
});

describe("GET /api/cron/cancel-expired-orders", () => {
  it("CRON_SECRET ausente + 'Bearer undefined' → 401, sem fan-out", async () => {
    vi.stubEnv("CRON_SECRET", undefined as unknown as string);
    const res = await GET(req("Bearer undefined"));
    expect(res.status).toBe(401);
    expect(h.dbCalls).toBe(0);
  });

  it("CRON_SECRET ausente + sem header → 401", async () => {
    vi.stubEnv("CRON_SECRET", undefined as unknown as string);
    expect((await GET(req())).status).toBe(401);
  });

  it("segredo errado → 401", async () => {
    vi.stubEnv("CRON_SECRET", "cron-test");
    expect((await GET(req("Bearer outro"))).status).toBe(401);
    expect(h.dbCalls).toBe(0);
  });

  it("segredo correto → executa", async () => {
    vi.stubEnv("CRON_SECRET", "cron-test");
    const res = await GET(req("Bearer cron-test"));
    expect(res.status).toBe(200);
    expect(h.dbCalls).toBe(1);
  });
});
