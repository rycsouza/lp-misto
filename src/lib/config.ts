import { getAllSiteConfig } from "./db/queries";
import { isPreviewEnv } from "./env";
import { parseBundleTiers, type BundleTier } from "./promotions/bundle";

/** Escudo padrão do clube (usado como fallback quando não configurado). */
export const DEFAULT_CLUB_LOGO_URL =
  "https://res.cloudinary.com/df798ispp/image/upload/misto/misto-logotipo.jpg";

/** Normaliza valor cru (string JSON ou array) em string[]. */
function parseStringArray(raw: unknown): string[] {
  let v = raw;
  if (typeof v === "string") {
    try { v = JSON.parse(v); } catch { return []; }
  }
  return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
}

export interface SiteConfigShape {
  whatsapp: string;
  email: string;
  instagram: string;
  clubLogoUrl: string;
  primaryColor: string;
  accentColor: string;
  ticketPriceInteiraCents: number;
  ticketPriceMeiaCents: number;
  meiaEligibilityLabel: string;
  ticketBundleTiers: BundleTier[];
  ticketBundleTypeCodes: string[]; // tipos elegíveis ao combo; vazio = todos
  raffleNumberPriceCents: number;
  shippingEnabled: boolean;
  shippingOriginCep: string;
  shippingFreeAboveCents: number;
  sections: Record<string, boolean>;
  [key: string]: unknown;
}

const DEFAULTS: SiteConfigShape = {
  whatsapp: "+5567991360075",
  email: "contato@mistoec.com.br",
  instagram: "https://www.instagram.com/misto.esporteclube",
  clubLogoUrl: DEFAULT_CLUB_LOGO_URL,
  primaryColor: "",
  accentColor: "",
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
  sections: {},
};

export async function getSiteConfig(): Promise<SiteConfigShape> {
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

    return config as SiteConfigShape;
  } catch {
    return DEFAULTS;
  }
}

export async function getSectionEnabled(key: string): Promise<boolean> {
  try {
    const rows = await getAllSiteConfig();
    if (isPreviewEnv()) {
      const previewRow = rows.find((r) => r.key === `preview.section.${key}.enabled`);
      if (previewRow) return previewRow.value !== "false";
    }
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

/** Returns a map of sectionKey → { enabled, order } for all known sections.
 *  In preview environments, `preview.section.X.enabled` overrides `section.X.enabled`. */
export async function getAllSectionMeta(
  keys: string[],
): Promise<Record<string, SectionMeta>> {
  try {
    const rows = await getAllSiteConfig();
    const preview = isPreviewEnv();
    const meta: Record<string, SectionMeta> = {};
    keys.forEach((key, i) => {
      let enabledRow = preview
        ? rows.find((r) => r.key === `preview.section.${key}.enabled`)
        : undefined;
      if (!enabledRow) enabledRow = rows.find((r) => r.key === `section.${key}.enabled`);
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
