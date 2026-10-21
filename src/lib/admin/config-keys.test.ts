import { describe, it, expect } from "vitest";
import {
  configKeyAccess,
  configUpdatesSchema,
  isValidSectionConfigValue,
  PLATFORM_KEYS,
  TENANT_CLUB_KEYS,
  TENANT_PICKUP_KEYS,
  SECTION_KEYS,
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

describe("mural dos sócios é uma seção como as demais (member_wall)", () => {
  it("está na lista de seções, logo antes da seção de sócio", () => {
    expect(SECTION_KEYS).toContain("member_wall");
    expect(SECTION_KEYS[SECTION_KEYS.indexOf("member_wall") + 1]).toBe("membership");
  });

  it("enabled, order e label são tenant (o admin do clube liga, ordena e renomeia)", () => {
    expect(configKeyAccess("section.member_wall.enabled")).toBe("tenant");
    expect(configKeyAccess("section.member_wall.order")).toBe("tenant");
    expect(configKeyAccess("section.member_wall.label")).toBe("tenant");
  });

  it("campos fora da lista continuam desconhecidos", () => {
    for (const key of ["section.member_wall", "section.member_wall.delete", "section.member_wall.enabled.x"]) {
      expect(configKeyAccess(key)).toBe("unknown");
    }
  });
});

describe("rótulo de cada seção (section.<key>.label)", () => {
  it("todas as seções conhecidas aceitam rótulo como tenant", () => {
    for (const key of SECTION_KEYS) {
      expect(configKeyAccess(`section.${key}.label`)).toBe("tenant");
    }
  });

  it("seção desconhecida ou campo parecido não ganha rótulo", () => {
    for (const key of ["section.foo.label", "section.news.labels", "section.news.title", "section.label"]) {
      expect(configKeyAccess(key)).toBe("unknown");
    }
  });
});

describe("isValidSectionConfigValue (aba Seções, antes de gravar)", () => {
  it("enabled aceita só 'true' ou 'false'", () => {
    expect(isValidSectionConfigValue("section.news.enabled", "true")).toBe(true);
    expect(isValidSectionConfigValue("section.news.enabled", "false")).toBe(true);
    for (const bad of ["", "TRUE", "1", "0", "yes", "true ", "false;drop", "null", "[]"]) {
      expect(isValidSectionConfigValue("section.news.enabled", bad), JSON.stringify(bad)).toBe(false);
      expect(isValidSectionConfigValue("section.member_wall.enabled", bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("order aceita inteiro de 0 a 999 e recusa o resto", () => {
    for (const ok of ["0", "7", "12", "999"]) {
      expect(isValidSectionConfigValue("section.member_wall.order", ok), ok).toBe(true);
    }
    for (const bad of ["", "-1", "1000", "1.5", "abc", " 2", "2 ", "0x1"]) {
      expect(isValidSectionConfigValue("section.member_wall.order", bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("label aceita vazio (padrão) ou rótulo válido, e recusa HTML e tamanho fora do limite", () => {
    expect(isValidSectionConfigValue("section.shop.label", "")).toBe(true);
    expect(isValidSectionConfigValue("section.shop.label", "Loja Oficial")).toBe(true);
    for (const bad of ["<b>x</b>", "A", "a".repeat(41), " Loja", "Loja 🛒"]) {
      expect(isValidSectionConfigValue("section.shop.label", bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("não afeta chaves que não são de seção", () => {
    expect(isValidSectionConfigValue("siteName", "qualquer coisa")).toBe(true);
    expect(isValidSectionConfigValue("pickupEnabled", "x")).toBe(true);
  });
});
