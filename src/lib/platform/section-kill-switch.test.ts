import { describe, expect, it, vi } from "vitest";

/**
 * Kill-switch do módulo de sócios na home: ao desligar "socios", somem a seção de sócio E o mural
 * (member_wall). Não consulta o platform DB: só a função pura de seções escondidas.
 */
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock("@/lib/db/platform/client", () => ({
  getPlatformDb: () => {
    throw new Error("não usado neste teste");
  },
}));

import { FEATURES, publicDisabledSectionKeys } from "./features";
import { HOME_SECTION_KEYS, orderHomeSections } from "@/lib/section-meta";

describe("módulo de sócios desligado: a home esconde sócio e mural", () => {
  it("o módulo socios declara a seção de sócio e o mural", () => {
    const socios = FEATURES.find((f) => f.key === "socios");
    expect(socios?.sections).toEqual(["membership", "member_wall"]);
  });

  it("com socios desligado para o público, o mural e a seção de sócio saem da home", () => {
    const hidden = publicDisabledSectionKeys(new Set(["socios"]));
    expect(hidden.has("member_wall")).toBe(true);
    expect(hidden.has("membership")).toBe(true);
    const meta = Object.fromEntries(HOME_SECTION_KEYS.map((k, i) => [k, { order: i + 1 }]));
    const visible = orderHomeSections(HOME_SECTION_KEYS, meta, hidden);
    expect(visible).not.toContain("member_wall");
    expect(visible).not.toContain("membership");
    expect(visible).toContain("news");
  });

  it("com outro módulo desligado, o mural segue na home", () => {
    const hidden = publicDisabledSectionKeys(new Set(["noticias"]));
    expect(hidden.has("member_wall")).toBe(false);
  });
});
