import { cache } from "react";
import { eq } from "drizzle-orm";
import { getPlatformDb } from "@/lib/db/platform/client";
import { platformFeatureFlags, platformFeatureOverrides } from "@/lib/db/platform/schema";

/**
 * Registry de features que o ADMIN DO SISTEMA pode ligar/desligar (kill-switch).
 * - `routes`: prefixos de rota do PAINEL governados (nav some + tela bloqueada).
 * - `publicRoutes`: prefixos de rota do SITE PÚBLICO (bloqueados só quando a
 *   feature está desligada E marcada para "refletir no público").
 * - `sections`: sectionKeys da home escondidas no mesmo caso.
 * Emergência: remover uma feature bugada rapidamente, no painel e/ou no site.
 */
export interface FeatureDef {
  key: string;
  label: string;
  description?: string;
  routes: string[];
  publicRoutes?: string[];
  sections?: string[];
}

export const FEATURES: FeatureDef[] = [
  { key: "loja",      label: "Loja / E-commerce",   routes: ["/admin/loja"], publicRoutes: ["/loja", "/checkout/produtos"], sections: ["shop"] },
  { key: "rifas",     label: "Sorteios",            routes: ["/admin/sorteios"], publicRoutes: ["/sorteio"], sections: ["raffle"] },
  { key: "cantina",   label: "Cantina",             routes: ["/admin/cantina"], publicRoutes: ["/cantina"] },
  { key: "socios",    label: "Sócio-Torcedor",      routes: ["/admin/socios"], publicRoutes: ["/socios"], sections: ["membership"] },
  { key: "cupons",    label: "Cupons e Promoções",  routes: ["/admin/cupons", "/admin/promocoes", "/admin/afiliados"] },
  { key: "upsell",    label: "Upsell",              routes: ["/admin/upsell"] },
  { key: "leads",     label: "Leads",               routes: ["/admin/leads"] },
  { key: "noticias",  label: "Notícias",            routes: ["/admin/noticias"], sections: ["news"] },
  { key: "validacao", label: "Validação de ingressos", routes: ["/admin/validacao"] },
  { key: "cortesia",  label: "Cortesias",           routes: ["/admin/cortesia"] },
  { key: "retirada",  label: "Retirada de pedidos", routes: ["/admin/retirada"] },
];

const FEATURE_KEYS = FEATURES.map((f) => f.key);

interface FlagResolution {
  disabled: boolean;
  publicToo: boolean;
}

/**
 * Estado efetivo de cada feature p/ o clube (orgId). `disabled` = override do
 * clube > flag global > ligado (default). `publicToo` = escopo global da feature
 * (reflete no site público quando desligada).
 *
 * Cacheado por request (React cache). FAIL-OPEN: sem PLATFORM_DATABASE_URL ou em
 * erro, tudo ligado — uma falha no platform DB nunca derruba painel nem site.
 */
const resolveFlags = cache(async (orgId: string | null): Promise<Map<string, FlagResolution>> => {
  const out = new Map<string, FlagResolution>();
  for (const k of FEATURE_KEYS) out.set(k, { disabled: false, publicToo: false });
  if (!process.env.PLATFORM_DATABASE_URL) return out;

  try {
    const db = getPlatformDb();
    const globals = await db.select().from(platformFeatureFlags);
    const globalMap = new Map(globals.map((g) => [g.key, g] as const));

    const overrideMap = new Map<string, boolean>();
    if (orgId) {
      const ovr = await db
        .select()
        .from(platformFeatureOverrides)
        .where(eq(platformFeatureOverrides.orgId, orgId));
      ovr.forEach((o) => overrideMap.set(o.key, o.enabled));
    }

    for (const key of FEATURE_KEYS) {
      const g = globalMap.get(key);
      const enabled = overrideMap.has(key) ? overrideMap.get(key)! : (g ? g.enabled : true);
      out.set(key, { disabled: !enabled, publicToo: g?.publicToo ?? false });
    }
    return out;
  } catch {
    return out;
  }
});

/** Features desligadas no PAINEL para o clube. */
export async function getDisabledFeatures(orgId: string | null): Promise<Set<string>> {
  const m = await resolveFlags(orgId);
  return new Set([...m].filter(([, v]) => v.disabled).map(([k]) => k));
}

/** Features desligadas E marcadas para refletir no SITE PÚBLICO. */
export async function getPublicDisabledFeatures(orgId: string | null): Promise<Set<string>> {
  const m = await resolveFlags(orgId);
  return new Set([...m].filter(([, v]) => v.disabled && v.publicToo).map(([k]) => k));
}

/** Prefixos de rota do painel governados por features desligadas. */
export function disabledRoutePrefixes(disabled: Set<string>): string[] {
  return FEATURES.filter((f) => disabled.has(f.key)).flatMap((f) => f.routes);
}

/** true se o pathname (painel) cai numa feature desligada. */
export function routeIsDisabled(pathname: string, disabled: Set<string>): boolean {
  return disabledRoutePrefixes(disabled).some((r) => pathname.startsWith(r));
}

/** true se o pathname (site público) cai numa feature desligada p/ o público. */
export function publicRouteIsDisabled(pathname: string, publicDisabled: Set<string>): boolean {
  return FEATURES.filter((f) => publicDisabled.has(f.key)).some((f) =>
    (f.publicRoutes ?? []).some((r) => pathname === r || pathname.startsWith(r + "/"))
  );
}

/** sectionKeys da home a esconder (features desligadas p/ o público). */
export function publicDisabledSectionKeys(publicDisabled: Set<string>): Set<string> {
  return new Set(FEATURES.filter((f) => publicDisabled.has(f.key)).flatMap((f) => f.sections ?? []));
}
