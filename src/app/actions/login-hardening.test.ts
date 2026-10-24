import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Login de admin (clube) e de plataforma: e-mail inexistente custa o mesmo que
 * senha errada (bcrypt de custo 12 contra hash VÁLIDO) e há rate limit por IP e
 * por e-mail antes de qualquer consulta.
 */
const h = vi.hoisted(() => ({
  limited: false,
  rlKeys: [] as string[],
  compared: [] as string[],
  dbCalls: 0,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers({ "x-tenant-slug": "clube-a", "x-forwarded-for": "203.0.113.7" }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({
  getClientIp: async () => "203.0.113.7",
  rateLimit: async (key: string) => {
    h.rlKeys.push(key);
    return { ok: !h.limited, remaining: 0 };
  },
}));
vi.mock("@/lib/email-admin", () => ({ sendInviteEmail: vi.fn() }));
function emptyDb() {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where"]) chain[m] = () => chain;
  chain.limit = async () => [];
  return chain;
}
vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    h.dbCalls++;
    return emptyDb();
  },
}));
vi.mock("@/lib/db/platform/client", () => ({
  getPlatformDb: () => {
    h.dbCalls++;
    return emptyDb();
  },
}));
vi.mock("bcryptjs", async (orig) => {
  const real = (await orig()) as { default: { hash: (p: string, c: number) => Promise<string> } };
  return {
    default: {
      hash: real.default.hash,
      compare: async (_pw: string, hash: string) => {
        h.compared.push(hash);
        return false;
      },
    },
  };
});

import { getDummyBcryptHash } from "@/lib/auth/dummy-hash";
import { platformLogin } from "./platform-auth";
import { adminLogin } from "./admin-auth";

function form(email: string, password = "senha-errada") {
  const f = new FormData();
  f.set("email", email);
  f.set("password", password);
  return f;
}
const VALID_COST12 = /^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/;

beforeEach(() => {
  h.limited = false;
  h.rlKeys = [];
  h.compared = [];
  h.dbCalls = 0;
});

describe("hash dummy de login", () => {
  it("é um bcrypt válido de 60 caracteres e custo 12 (o literal antigo tinha 59)", async () => {
    const hash = await getDummyBcryptHash();
    expect(hash).toHaveLength(60);
    expect(hash).toMatch(VALID_COST12);
  });
});

describe("platformLogin", () => {
  it("e-mail inexistente compara contra hash válido (sem atalho de timing)", async () => {
    const r = await platformLogin(form("ninguem@example.test"));
    expect(r).toEqual({ success: false, error: "Credenciais inválidas" });
    expect(h.compared).toHaveLength(1);
    expect(h.compared[0]).toMatch(VALID_COST12);
  });

  it("rate limit por IP e por e-mail barra antes do banco", async () => {
    h.limited = true;
    const r = await platformLogin(form("p@example.test"));
    expect(r.success).toBe(false);
    expect(h.dbCalls).toBe(0);
    expect(h.compared).toEqual([]);
    expect(h.rlKeys).toEqual(["rl:platform-login:ip:203.0.113.7", "rl:platform-login:em:p@example.test"]);
  });
});

describe("adminLogin", () => {
  it("e-mail inexistente compara contra hash válido (antes retornava na hora)", async () => {
    const r = await adminLogin(form("ninguem@example.test"));
    expect(r).toEqual({ success: false, error: "Credenciais inválidas" });
    expect(h.compared).toHaveLength(1);
    expect(h.compared[0]).toMatch(VALID_COST12);
  });

  it("rate limit por IP e por e-mail do clube barra antes do banco", async () => {
    h.limited = true;
    const r = await adminLogin(form("a@example.test"));
    expect(r.success).toBe(false);
    expect(h.compared).toEqual([]);
    expect(h.rlKeys).toEqual(["rl:admin-login:ip:203.0.113.7", "rl:admin-login:em:clube-a:a@example.test"]);
  });
});
