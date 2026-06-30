import { cache } from "react";
import { getAllSiteConfig } from "./db/queries";
import { parseBundleTiers, type BundleTier } from "./promotions/bundle";

/** Logo padrão — VAZIO de propósito (multi-tenant). Cada tenant define o seu em
 *  `clubLogoUrl`; a UI degrada graciosamente quando vazio (esconde/usa iniciais).
 *  NÃO colocar o logo do misto aqui — vazaria para tenants sem logo configurado. */
export const DEFAULT_CLUB_LOGO_URL = "";

export interface HeroStat { value: string; label: string; }

/** Normaliza stats do hero (array de {value,label}) a partir de JSON/array. */
function parseHeroStats(raw: unknown): HeroStat[] {
  let v = raw;
  if (typeof v === "string") {
    try { v = JSON.parse(v); } catch { return []; }
  }
  if (!Array.isArray(v)) return [];
  return v
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({ value: String(s.value ?? ""), label: String(s.label ?? "") }))
    .filter((s) => s.value || s.label);
}

/** Normaliza valor cru (string JSON ou array) em string[]. */
function parseStringArray(raw: unknown): string[] {
  let v = raw;
  if (typeof v === "string") {
    try { v = JSON.parse(v); } catch { return []; }
  }
  return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
}

/** Ponto de retirada de produtos, configurável no painel. */
export interface PickupLocation {
  id: string;
  name: string;
  address: string;
  hours: string; // ex: "7h às 17h"
}

/** Normaliza valor cru (string JSON ou array) em PickupLocation[]. */
function parsePickupLocations(raw: unknown): PickupLocation[] {
  let v = raw;
  if (typeof v === "string") {
    try { v = JSON.parse(v); } catch { return []; }
  }
  if (!Array.isArray(v)) return [];
  return v
    .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
    .map((l) => ({
      id: String(l.id ?? ""),
      name: String(l.name ?? ""),
      address: String(l.address ?? ""),
      hours: String(l.hours ?? ""),
    }))
    .filter((l) => l.name);
}

export interface SiteConfigShape {
  siteName: string;
  faviconUrl: string;
  whatsapp: string;
  email: string;
  instagram: string;
  clubLogoUrl: string;
  primaryColor: string;
  accentColor: string;
  // ── Identidade do tenant (multi-tenant) — vazio = esconde/usa genérico ──
  tagline: string;            // ex.: "O Carcará da Fronteira"
  description: string;        // descrição SEO/OpenGraph
  keywords: string[];         // palavras-chave SEO
  city: string;               // ex.: "Três Lagoas/MS"
  foundedYear: string;        // ex.: "1993"
  heroImageUrl: string;       // imagem de destaque do hero
  heroStats: HeroStat[];      // ex.: [{value:"1993",label:"Fundação"}]
  // ── Tema estendido (Fase 3) — vazio = usa o token do build ──
  backgroundColor: string;
  cardColor: string;
  foregroundColor: string;
  fontHeading: string;        // família p/ títulos (CSS font-family)
  fontBody: string;           // família p/ corpo
  ticketPriceInteiraCents: number;
  ticketPriceMeiaCents: number;
  meiaEligibilityLabel: string;
  ticketBundleTiers: BundleTier[];
  ticketBundleTypeCodes: string[]; // tipos elegíveis ao combo; vazio = todos
  raffleNumberPriceCents: number;
  shippingEnabled: boolean;
  shippingOriginCep: string;
  shippingFreeAboveCents: number;
  pickupEnabled: boolean;
  pickupLocations: PickupLocation[];
  sections: Record<string, boolean>;
  [key: string]: unknown;
}

const DEFAULTS: SiteConfigShape = {
  // Neutros de propósito (multi-tenant): nada do misto aqui. O misto define os
  // seus valores no próprio site_config (DB). Tenant sem config → genérico/vazio.
  siteName: "",
  faviconUrl: "",
  whatsapp: "",
  email: "",
  instagram: "",
  clubLogoUrl: DEFAULT_CLUB_LOGO_URL,
  primaryColor: "",
  accentColor: "",
  tagline: "",
  description: "",
  keywords: [],
  city: "",
  foundedYear: "",
  heroImageUrl: "",
  heroStats: [],
  backgroundColor: "",
  cardColor: "",
  foregroundColor: "",
  fontHeading: "",
  fontBody: "",
  ticketPriceInteiraCents: 2000,
  ticketPriceMeiaCents: 1000,
  meiaEligibilityLabel:
    "Estudantes, idosos acima de 60 anos e demais casos previstos em lei (apresentar documento na entrada).",
  ticketBundleTiers: [],
  ticketBundleTypeCodes: [],
  raffleNumberPriceCents: 500,
  shippingEnabled: true,
  shippingOriginCep: "",
  shippingFreeAboveCents: 0,
  pickupEnabled: false,
  pickupLocations: [],
  sections: {},
};

// Memoiza por request (React cache): várias chamadas dentro do mesmo
// request/render batem no banco UMA vez. Não introduz staleness entre requests
// — cada novo request relê o DB, mantendo o conteúdo admin refletindo na hora.
export const getSiteConfig = cache(async (): Promise<SiteConfigShape> => {
  try {
    const rows = await getAllSiteConfig();
    const config: Record<string, unknown> = { ...DEFAULTS };

    for (const row of rows) {
      let parsed: unknown = row.value;
      if (row.type === "number") parsed = Number(row.value);
      else if (row.type === "boolean") parsed = row.value === "true";
      else if (row.type === "json") {
        try {
          parsed = JSON.parse(row.value);
        } catch {
          parsed = row.value;
        }
      }
      config[row.key] = parsed;
    }

    // Faixas de combo são salvas como string JSON — sempre devolve um array normalizado
    config.ticketBundleTiers = parseBundleTiers(config.ticketBundleTiers);
    config.ticketBundleTypeCodes = parseStringArray(config.ticketBundleTypeCodes);
    config.pickupLocations = parsePickupLocations(config.pickupLocations);
    config.heroStats = parseHeroStats(config.heroStats);
    config.keywords = parseStringArray(config.keywords);

    return config as SiteConfigShape;
  } catch {
    return DEFAULTS;
  }
});

export async function getSectionEnabled(key: string): Promise<boolean> {
  try {
    const rows = await getAllSiteConfig();
    const row = rows.find((r) => r.key === `section.${key}.enabled`);
    if (!row) return true;
    return row.value !== "false";
  } catch {
    return true;
  }
}

export interface SectionMeta {
  enabled: boolean;
  order: number;
}

/** Returns a map of sectionKey → { enabled, order } for all known sections. */
export async function getAllSectionMeta(
  keys: string[],
): Promise<Record<string, SectionMeta>> {
  try {
    const rows = await getAllSiteConfig();
    const meta: Record<string, SectionMeta> = {};
    keys.forEach((key, i) => {
      const enabledRow = rows.find((r) => r.key === `section.${key}.enabled`);
      const order = rows.find((r) => r.key === `section.${key}.order`);
      meta[key] = {
        enabled: enabledRow ? enabledRow.value !== "false" : true,
        order: order ? Number(order.value) : i + 1,
      };
    });
    return meta;
  } catch {
    return Object.fromEntries(keys.map((k, i) => [k, { enabled: true, order: i + 1 }]));
  }
}
