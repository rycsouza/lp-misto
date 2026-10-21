import { describe, it, expect } from "vitest";
import {
  configKeyAccess,
  configUpdatesSchema,
  isValidHomeToggleValue,
  MEMBER_WALL_KEY,
  PLATFORM_KEYS,
  TENANT_CLUB_KEYS,
  TENANT_PICKUP_KEYS,
  SECTION_KEYS,
  TENANT_HOME_TOGGLE_KEYS,
  TENANT_MEMBER_CARD_KEYS,
} from "./config-keys";

describe("configKeyAccess", () => {
  it("classifica as chaves das telas do admin do clube como tenant", () => {
    for (const key of [...TENANT_CLUB_KEYS, ...TENANT_PICKUP_KEYS]) {
      expect(configKeyAccess(key)).toBe("tenant");
    }
    for (const key of SECTION_KEYS) {
      expect(configKeyAccess(`section.${key}.enabled`)).toBe("tenant");
      expect(configKeyAccess(`section.${key}.order`)).toBe("tenant");
    }
  });

  it("classifica mídia, aparência, loja, segurança e ingressos como platform", () => {
    for (const key of PLATFORM_KEYS) {
      expect(configKeyAccess(key)).toBe("platform");
    }
    expect(configKeyAccess("sessionDurationHours")).toBe("platform");
    expect(configKeyAccess("clubLogoUrl")).toBe("platform");
    expect(configKeyAccess("heroStats")).toBe("platform");
    expect(configKeyAccess("ticketPriceInteiraCents")).toBe("platform");
  });

  it("não há chave nas duas listas", () => {
    const tenant = new Set<string>([...TENANT_CLUB_KEYS, ...TENANT_PICKUP_KEYS]);
    for (const key of PLATFORM_KEYS) expect(tenant.has(key)).toBe(false);
  });

  it("recusa chaves desconhecidas, seções fora da lista e campos de seção inválidos", () => {
    for (const key of [
      "",
      "club.pix_key",
      "section.foo.enabled",
      "section.news.delete",
      "section.news",
      "section.news.enabled.extra",
      "constructor",
      "__proto__",
      "hasOwnProperty",
    ]) {
      expect(configKeyAccess(key)).toBe("unknown");
    }
  });
});

describe("configUpdatesSchema", () => {
  it("aceita objeto plano de strings", () => {
    expect(configUpdatesSchema.safeParse({ siteName: "Misto" }).success).toBe(true);
  });

  it("rejeita arrays e não-objetos", () => {
    expect(configUpdatesSchema.safeParse(["a"]).success).toBe(false);
    expect(configUpdatesSchema.safeParse("a").success).toBe(false);
    expect(configUpdatesSchema.safeParse(null).success).toBe(false);
  });

  it("rejeita valores que não são string", () => {
    expect(configUpdatesSchema.safeParse({ a: 1 }).success).toBe(false);
    expect(configUpdatesSchema.safeParse({ a: true }).success).toBe(false);
  });
});

describe("limites do schema", () => {
  it("rejeita chave acima de 100 caracteres", () => {
    expect(configUpdatesSchema.safeParse({ ["k".repeat(101)]: "v" }).success).toBe(false);
    expect(configUpdatesSchema.safeParse({ ["k".repeat(100)]: "v" }).success).toBe(true);
  });

  it("rejeita mais de 100 chaves e lista vazia", () => {
    const many = Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`k${i}`, "v"]));
    expect(configUpdatesSchema.safeParse(many).success).toBe(false);
    expect(configUpdatesSchema.safeParse({}).success).toBe(false);
  });

  it("rejeita valor acima de 20.000 caracteres e aceita exatamente 20.000", () => {
    expect(configUpdatesSchema.safeParse({ a: "x".repeat(20_001) }).success).toBe(false);
    expect(configUpdatesSchema.safeParse({ a: "x".repeat(20_000) }).success).toBe(true);
  });
});

describe("fundo da carteirinha (admin do clube)", () => {
  it("as quatro chaves do fundo são tenant (página Visual da carteirinha, módulo socios)", () => {
    for (const key of [
      "memberCardBackgroundUrl",
      "memberCardBackgroundFit",
      "memberCardBackgroundOpacity",
      "memberCardBackgroundBlend",
    ]) {
      expect(configKeyAccess(key)).toBe("tenant");
    }
    expect(TENANT_MEMBER_CARD_KEYS).toEqual([
      "memberCardBackgroundUrl",
      "memberCardBackgroundFit",
      "memberCardBackgroundOpacity",
      "memberCardBackgroundBlend",
    ]);
  });

  it("chaves parecidas que não existem continuam desconhecidas", () => {
    for (const key of ["memberCardBackground", "memberCardBackgroundUrl.x", "memberCardBackgroundPrice"]) {
      expect(configKeyAccess(key)).toBe("unknown");
    }
  });
});

describe("app Android (admin do sistema)", () => {
  it("androidPackageName e androidCertFingerprints são platform, nunca tenant", () => {
    expect(configKeyAccess("androidPackageName")).toBe("platform");
    expect(configKeyAccess("androidCertFingerprints")).toBe("platform");
  });
});

describe("toggle do mural dos sócios (section.member_wall.enabled)", () => {
  it("é tenant (o admin do clube liga e desliga) e tem o nome de chave esperado", () => {
    expect(MEMBER_WALL_KEY).toBe("section.member_wall.enabled");
    expect(TENANT_HOME_TOGGLE_KEYS).toEqual(["section.member_wall.enabled"]);
    expect(configKeyAccess("section.member_wall.enabled")).toBe("tenant");
  });

  it("não tem campo de ordem: fica fora de SECTION_KEYS (que libera .order)", () => {
    expect(SECTION_KEYS).not.toContain("member_wall");
    expect(configKeyAccess("section.member_wall.order")).toBe("unknown");
    expect(configKeyAccess("section.member_wall")).toBe("unknown");
    expect(configKeyAccess("section.member_wall.delete")).toBe("unknown");
  });

  it("aceita só 'true' ou 'false' para o mural", () => {
    expect(isValidHomeToggleValue(MEMBER_WALL_KEY, "true")).toBe(true);
    expect(isValidHomeToggleValue(MEMBER_WALL_KEY, "false")).toBe(true);
    for (const bad of ["", "TRUE", "1", "0", "yes", "true ", "false;drop", "null", "[]"]) {
      expect(isValidHomeToggleValue(MEMBER_WALL_KEY, bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("a validação do valor não afeta outras chaves", () => {
    expect(isValidHomeToggleValue("siteName", "qualquer coisa")).toBe(true);
    expect(isValidHomeToggleValue("section.news.enabled", "x")).toBe(true);
  });
});
