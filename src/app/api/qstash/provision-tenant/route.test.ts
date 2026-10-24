import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Consumidor de provisionamento: sem as DUAS chaves de assinatura do QStash
 * configuradas, nenhuma mensagem é aceita (antes o corpo cru era confiado e
 * qualquer um provisionava tenant, DNS, convite de admin...).
 */
const h = vi.hoisted(() => ({ sideEffects: 0, verified: 0 }));

vi.mock("@upstash/qstash", () => ({
  Receiver: class {
    async verify() {
      h.verified++;
      return true;
    }
  },
}));
vi.mock("@upstash/redis", () => ({
  Redis: class {
    async set() {
      h.sideEffects++;
      return "OK";
    }
  },
}));
vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    h.sideEffects++;
    return () => [];
  },
}));
vi.mock("@/lib/db/platform/client", () => ({
  getPlatformDb: () => {
    h.sideEffects++;
    throw new Error("não deveria chegar aqui");
  },
}));
vi.mock("@/lib/dns", () => ({ registerTenantSubdomain: async () => h.sideEffects++ }));
vi.mock("@/lib/email-admin", () => ({ sendTenantOnboardingEmail: async () => h.sideEffects++ }));

import { POST } from "./route";

const body = {
  jobId: "j",
  name: "n",
  slug: "s",
  domain: "d.example.test",
  connectionUri: "postgres://u:p@db.example.test/x",
  ownerName: "o",
  ownerEmail: "o@example.test",
};
const req = () =>
  new Request("https://app.example.test/api/qstash/provision-tenant", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  h.sideEffects = 0;
  h.verified = 0;
  vi.unstubAllEnvs();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
  vi.stubEnv("ENCRYPTION_KEY_PLATFORM_DB", "0".repeat(64));
});

describe("POST /api/qstash/provision-tenant — fail-closed", () => {
  it("sem nenhuma chave de assinatura → 401, sem efeitos", async () => {
    vi.stubEnv("QSTASH_CURRENT_SIGNING_KEY", undefined as unknown as string);
    vi.stubEnv("QSTASH_NEXT_SIGNING_KEY", undefined as unknown as string);
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(h.sideEffects).toBe(0);
    expect(h.verified).toBe(0);
  });

  it("com só uma das chaves → 401, sem efeitos", async () => {
    vi.stubEnv("QSTASH_CURRENT_SIGNING_KEY", "k1");
    vi.stubEnv("QSTASH_NEXT_SIGNING_KEY", undefined as unknown as string);
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(h.sideEffects).toBe(0);
  });

  it("com as duas chaves → verifica a assinatura", async () => {
    vi.stubEnv("QSTASH_CURRENT_SIGNING_KEY", "k1");
    vi.stubEnv("QSTASH_NEXT_SIGNING_KEY", "k2");
    await POST(req()).catch(() => null);
    expect(h.verified).toBe(1);
  });
});
