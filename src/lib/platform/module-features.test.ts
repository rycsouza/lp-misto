import { describe, it, expect, vi } from "vitest";

/**
 * Mapa módulo → feature do kill-switch. Garante que toda feature mapeada existe
 * no registry (features.ts) e que os módulos que deviam ter kill-switch têm.
 */
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
  revalidateTag: () => {},
  revalidatePath: () => {},
}));
vi.mock("@/lib/db/platform/client", () => ({
  getPlatformDb: () => {
    throw new Error("não deve ser usado neste teste");
  },
}));

import { MODULE_FEATURE, featureForModule } from "./module-features";
import { FEATURES } from "./features";

describe("MODULE_FEATURE", () => {
  it("toda feature mapeada existe no registry de features", () => {
    const keys = new Set(FEATURES.map((f) => f.key));
    for (const feature of MODULE_FEATURE.values()) {
      expect(keys.has(feature)).toBe(true);
    }
  });

  it("loja, rifas, cortesia e retirada têm kill-switch na própria feature", () => {
    expect(featureForModule("loja")).toBe("loja");
    expect(featureForModule("rifas")).toBe("rifas");
    expect(featureForModule("cortesia")).toBe("cortesia");
    expect(featureForModule("retirada")).toBe("retirada");
  });

  it("permissões sem feature própria seguem sem kill-switch (ex.: pedidos, jogos)", () => {
    expect(featureForModule("pedidos")).toBeNull();
    expect(featureForModule("jogos")).toBeNull();
    expect(featureForModule("dashboard")).toBeNull();
  });
});
