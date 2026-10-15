import { describe, it, expect } from "vitest";
import {
  configKeyAccess,
  configUpdatesSchema,
  PLATFORM_KEYS,
  TENANT_CLUB_KEYS,
  TENANT_PICKUP_KEYS,
  SECTION_KEYS,
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
