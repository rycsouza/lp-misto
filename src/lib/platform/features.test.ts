import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Kill-switch da plataforma: resolução de features por clube (features.ts) e
 * mapeamento módulo → feature (module-features.ts). Usa o platform DB falso.
 */
const h = vi.hoisted(() => ({
  globals: [] as Array<{ key: string; enabled: boolean; publicToo: boolean }>,
  overrides: [] as Array<{ orgId: string; key: string; enabled: boolean }>,
  orgs: [] as Array<{ id: string }>,
  fail: false,
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
  revalidateTag: () => {},
  revalidatePath: () => {},
}));

vi.mock("@/lib/db/platform/client", async () => {
  const schema = await import("@/lib/db/platform/schema");
  const rowsFor = (table: unknown) => {
    if (table === schema.platformFeatureFlags) return h.globals;
    if (table === schema.platformFeatureOverrides) return h.overrides;
    return h.orgs;
  };
  return {
    getPlatformDb: () => ({
      select: () => ({
        from: (table: unknown) => {
          const run = () => (h.fail ? Promise.reject(new Error("neon down")) : Promise.resolve(rowsFor(table)));
          // Query encadeável e "thenable": where/limit devolvem a mesma query.
          const q = {
            where: () => q,
            limit: () => q,
            then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => run().then(res, rej),
          };
          return q;
        },
      }),
    }),
  };
});

import { FEATURES, getDisabledFeatures, getOrgIdBySlug } from "./features";
import { MODULE_FEATURE, featureForModule } from "./module-features";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";

let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  h.globals = [];
  h.overrides = [];
  h.orgs = [];
  h.fail = false;
  process.env.PLATFORM_DATABASE_URL = "postgres://plataforma.test/db";
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.PLATFORM_DATABASE_URL;
  errSpy.mockRestore();
});

describe("getDisabledFeatures: override do clube > flag global > ligado", () => {
  it("sem linhas no banco, nada fica desligado (default ligado)", async () => {
    expect((await getDisabledFeatures(ORG_A)).size).toBe(0);
  });

  it("flag global desligada vale para qualquer clube", async () => {
    h.globals = [{ key: "validacao", enabled: false, publicToo: false }];
    expect((await getDisabledFeatures(ORG_A)).has("validacao")).toBe(true);
    expect((await getDisabledFeatures(ORG_B)).has("validacao")).toBe(true);
  });

  // Obs.: o filtro por orgId é feito no SQL (where(eq(orgId, ...))); o fake devolve
  // as linhas já "filtradas" para o clube consultado. Aqui testamos a combinação.
  it("override 'off' do clube desliga a feature para ele", async () => {
    h.overrides = [{ orgId: ORG_A, key: "socios", enabled: false }];
    expect((await getDisabledFeatures(ORG_A)).has("socios")).toBe(true);
  });

  it("override 'on' do clube vence a flag global desligada", async () => {
    h.globals = [{ key: "cupons", enabled: false, publicToo: false }];
    h.overrides = [{ orgId: ORG_A, key: "cupons", enabled: true }];
    expect((await getDisabledFeatures(ORG_A)).has("cupons")).toBe(false);
  });

  it("clube sem override segue a flag global desligada", async () => {
    h.globals = [{ key: "cupons", enabled: false, publicToo: false }];
    expect((await getDisabledFeatures(ORG_B)).has("cupons")).toBe(true);
  });
});

describe("getDisabledFeatures: erro ao ler o platform DB (fail-open, logado)", () => {
  it("retorna tudo ligado e registra o erro sem mensagem/URL", async () => {
    h.fail = true;
    const disabled = await getDisabledFeatures(ORG_A);
    expect(disabled.size).toBe(0);
    expect(errSpy).toHaveBeenCalled();
    const logged = JSON.stringify(errSpy.mock.calls);
    expect(logged).toContain("[features]");
    expect(logged).not.toContain("neon down");
  });

  it("sem PLATFORM_DATABASE_URL não consulta o banco e tudo segue ligado", async () => {
    delete process.env.PLATFORM_DATABASE_URL;
    h.fail = true; // se consultasse, o erro apareceria
    expect((await getDisabledFeatures(ORG_A)).size).toBe(0);
    expect(errSpy).not.toHaveBeenCalled();
  });
});

describe("getOrgIdBySlug", () => {
  it("devolve o id do clube pelo slug", async () => {
    h.orgs = [{ id: ORG_A }];
    expect(await getOrgIdBySlug("clube-a")).toBe(ORG_A);
  });

  it("slug inexistente → null", async () => {
    expect(await getOrgIdBySlug("nao-existe")).toBeNull();
  });

  it("erro de leitura → null (fail-open, logado)", async () => {
    h.fail = true;
    expect(await getOrgIdBySlug("clube-a")).toBeNull();
    expect(errSpy).toHaveBeenCalled();
  });
});

describe("mapeamento módulo → feature", () => {
  it("módulos de validação, sócio, cupons, crescimento e notícias apontam para a feature homônima", () => {
    expect(featureForModule("validacao")).toBe("validacao");
    expect(featureForModule("socios")).toBe("socios");
    expect(featureForModule("cupons")).toBe("cupons");
    expect(featureForModule("upsell")).toBe("upsell");
    expect(featureForModule("leads")).toBe("leads");
    expect(featureForModule("noticias")).toBe("noticias");
  });

  it("submódulos da cantina apontam para a feature 'cantina'", () => {
    expect(featureForModule("cantina_catalogo")).toBe("cantina");
    expect(featureForModule("cantina_preparo")).toBe("cantina");
    expect(featureForModule("cantina_entrega")).toBe("cantina");
  });

  it("módulo sem feature → null (segue sem kill-switch)", () => {
    expect(featureForModule("jogos")).toBeNull();
    expect(featureForModule("dashboard")).toBeNull();
    expect(featureForModule("pedidos")).toBeNull();
  });

  it("chaves herdadas do Object.prototype não viram feature", () => {
    expect(featureForModule("constructor")).toBeNull();
    expect(featureForModule("__proto__")).toBeNull();
  });

  it("toda feature mapeada existe no registry FEATURES (evita drift)", () => {
    const keys = new Set(FEATURES.map((f) => f.key));
    for (const [module, feature] of MODULE_FEATURE) {
      expect(keys.has(feature), `módulo ${module} → feature inexistente ${feature}`).toBe(true);
    }
  });
});
