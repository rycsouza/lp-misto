import { describe, it, expect, beforeEach, vi } from "vitest";
import { SignJWT } from "jose";

/**
 * Provisionar tenant (Neon, DNS, domínio no platform DB, convite de admin) é
 * exclusivo do ADMIN DO SISTEMA. O JWT de admin de tenant (role "admin", sem
 * escopo de plataforma) não pode autorizar — qualquer admin de clube o possui.
 */
const h = vi.hoisted(() => ({
  cookies: {} as Record<string, string>,
  platformAdmins: [] as { id: string; email: string; name: string; active: boolean }[],
  neonCalls: [] as string[],
  publishCalls: [] as unknown[],
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (h.cookies[n] !== undefined ? { name: n, value: h.cookies[n] } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/db/platform/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where"]) chain[m] = () => chain;
  chain.limit = async () => h.platformAdmins;
  return { getPlatformDb: () => chain };
});
vi.mock("@/lib/neon-api", () => ({
  createNeonProject: async (name: string) => {
    h.neonCalls.push(name);
    return { projectId: "p", connectionUri: "postgres://u:p@db.example.test/x" };
  },
}));
vi.mock("@upstash/qstash", () => ({
  Client: class {
    async publishJSON(arg: unknown) {
      h.publishCalls.push(arg);
      return { messageId: "m" };
    }
  },
}));
vi.mock("@upstash/redis", () => ({
  Redis: class {
    async set() {
      return "OK";
    }
  },
}));

import { POST } from "./route";

const ADMIN_SECRET = "test-admin-secret-0000000000000000";
const PLATFORM_SECRET = "test-platform-secret-00000000000000";
const PLATFORM_ADMIN_ID = "00000000-0000-4000-8000-000000000001";

function sign(claims: Record<string, unknown>, secret: string) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
}

const tenantAdminToken = () =>
  sign({ userId: crypto.randomUUID(), email: "a@clube.test", name: "A", role: "admin", permissions: {} }, ADMIN_SECRET);
const platformToken = () =>
  sign({ adminId: PLATFORM_ADMIN_ID, email: "p@sport55.test", name: "P", scope: "platform" }, PLATFORM_SECRET);

function req() {
  return new Request("https://clube.example.test/api/admin/tenants", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "x", slug: "x", domain: "x.example.test", ownerName: "o", ownerEmail: "o@example.test" }),
  });
}

beforeEach(() => {
  h.cookies = {};
  h.platformAdmins = [];
  h.neonCalls = [];
  h.publishCalls = [];
  vi.stubEnv("ADMIN_JWT_SECRET", ADMIN_SECRET);
  vi.stubEnv("PLATFORM_JWT_SECRET", PLATFORM_SECRET);
  vi.stubEnv("QSTASH_TOKEN", "t");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
  vi.stubEnv("APP_URL", "https://app.example.test");
});

describe("POST /api/admin/tenants — somente admin do sistema", () => {
  it("sem cookie → 401, nada é provisionado", async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(h.neonCalls).toEqual([]);
    expect(h.publishCalls).toEqual([]);
  });

  it("JWT de admin de TENANT (role admin) → 401, nada é provisionado", async () => {
    h.cookies.misto_admin_token = await tenantAdminToken();
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(h.neonCalls).toEqual([]);
    expect(h.publishCalls).toEqual([]);
  });

  it("token de plataforma de admin DESATIVADO → 401", async () => {
    h.cookies.sport55_platform_token = await platformToken();
    h.platformAdmins = [{ id: PLATFORM_ADMIN_ID, email: "p@sport55.test", name: "P", active: false }];
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(h.neonCalls).toEqual([]);
  });

  it("token de tenant assinado com o segredo de plataforma, sem scope → 401", async () => {
    h.cookies.sport55_platform_token = await sign({ adminId: PLATFORM_ADMIN_ID, role: "admin" }, PLATFORM_SECRET);
    h.platformAdmins = [{ id: PLATFORM_ADMIN_ID, email: "p@sport55.test", name: "P", active: true }];
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it("admin do sistema ativo → provisiona", async () => {
    h.cookies.sport55_platform_token = await platformToken();
    h.platformAdmins = [{ id: PLATFORM_ADMIN_ID, email: "p@sport55.test", name: "P", active: true }];
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(h.neonCalls).toEqual(["tenant-x"]);
    expect(h.publishCalls).toHaveLength(1);
  });
});
