import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Salvar produto no painel limpa o cache público do CLUBE (tag tenant:<slug>): a vitrine lê
 * os produtos com cache e, sem isso, a imagem nova só aparecia depois do TTL.
 */
const h = vi.hoisted(() => ({ tags: [] as string[], paths: [] as string[] }));

vi.mock("@/lib/admin/auth-guard", () => ({
  checkModuleAccess: async () => ({ session: { role: "admin" } }),
  requireModuleFor: async () => ({}),
}));
vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));
vi.mock("@/lib/db/queries", () => ({ currentTenantSlug: async () => "clube-a" }));
vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    const chain: unknown = new Proxy(function () {}, {
      get: (_t, prop) => {
        if (prop === "then") return (res: (v: unknown) => void) => res([{ id: "p1" }]);
        return () => chain;
      },
      apply: () => chain,
    });
    return { update: () => chain, insert: () => chain, select: () => chain, delete: () => chain };
  },
}));
vi.mock("next/cache", () => ({
  revalidatePath: (p: string) => {
    h.paths.push(p);
  },
  revalidateTag: (t: string) => {
    h.tags.push(t);
  },
}));

import { updateProduct } from "./admin-shop";

beforeEach(() => {
  h.tags = [];
  h.paths = [];
});

describe("cache da loja após salvar produto", () => {
  it("trocar a imagem do produto invalida o cache público do clube e o painel", async () => {
    const r = await updateProduct("0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f", { imageUrl: "https://res.cloudinary.com/x/nova.jpg" });
    expect(r.success).toBe(true);
    expect(h.tags).toContain("tenant:clube-a");
    expect(h.paths).toContain("/admin/loja");
  });
});
