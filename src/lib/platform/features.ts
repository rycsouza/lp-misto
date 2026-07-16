import { cache } from "react";
import { eq } from "drizzle-orm";
import { getPlatformDb } from "@/lib/db/platform/client";
import { platformFeatureFlags, platformFeatureOverrides } from "@/lib/db/platform/schema";

/**
 * Registry de features que o ADMIN DO SISTEMA pode ligar/desligar (kill-switch).
 * `routes` = prefixos de rota do PAINEL que a feature governa: quando desligada,
 * os itens de nav com href sob esses prefixos somem e as telas são bloqueadas.
 * Emergência: remover uma feature bugada de todos os clubes rapidamente.
 */
export interface FeatureDef {
  key: string;
  label: string;
  description?: string;
  routes: string[];
}

export const FEATURES: FeatureDef[] = [
  { key: "loja",      label: "Loja / E-commerce",   routes: ["/admin/loja"] },
  { key: "cantina",   label: "Cantina",             routes: ["/admin/cantina"] },
  { key: "socios",    label: "Sócio-Torcedor",      routes: ["/admin/socios"] },
  { key: "cupons",    label: "Cupons e Promoções",  routes: ["/admin/cupons", "/admin/promocoes", "/admin/afiliados"] },
  { key: "upsell",    label: "Upsell",              routes: ["/admin/upsell"] },
  { key: "leads",     label: "Leads",               routes: ["/admin/leads"] },
  { key: "noticias",  label: "Notícias",            routes: ["/admin/noticias"] },
  { key: "validacao", label: "Validação de ingressos", routes: ["/admin/validacao"] },
  { key: "cortesia",  label: "Cortesias",           routes: ["/admin/cortesia"] },
  { key: "retirada",  label: "Retirada de pedidos", routes: ["/admin/retirada"] },
];

const FEATURE_KEYS = new Set(FEATURES.map((f) => f.key));

/**
 * Features DESLIGADAS para o clube (orgId). Efetivo = override do clube, senão
 * flag global, senão ligado (default). Cacheado por request (React cache).
 *
 * FAIL-OPEN: sem PLATFORM_DATABASE_URL ou em erro, retorna conjunto vazio (tudo
 * ligado). Uma falha no platform DB JAMAIS deve derrubar o painel de um clube.
 */
export const getDisabledFeatures = cache(async (orgId: string | null): Promise<Set<string>> => {
  if (!process.env.PLATFORM_DATABASE_URL) return new Set();
  try {
    const db = getPlatformDb();
    const globals = await db.select().from(platformFeatureFlags);
    const globalMap = new Map(globals.map((g) => [g.key, g.enabled]));

    const overrideMap = new Map<string, boolean>();
    if (orgId) {
      const ovr = await db
        .select()
        .from(platformFeatureOverrides)
        .where(eq(platformFeatureOverrides.orgId, orgId));
      ovr.forEach((o) => overrideMap.set(o.key, o.enabled));
    }

    const disabled = new Set<string>();
    for (const key of FEATURE_KEYS) {
      const effective = overrideMap.has(key)
        ? overrideMap.get(key)!
        : globalMap.has(key)
          ? globalMap.get(key)!
          : true;
      if (!effective) disabled.add(key);
    }
    return disabled;
  } catch {
    return new Set();
  }
});

/** Prefixos de rota do painel governados por features desligadas. */
export function disabledRoutePrefixes(disabled: Set<string>): string[] {
  return FEATURES.filter((f) => disabled.has(f.key)).flatMap((f) => f.routes);
}

/** true se o pathname cai numa feature desligada (para bloquear a tela). */
export function routeIsDisabled(pathname: string, disabled: Set<string>): boolean {
  return disabledRoutePrefixes(disabled).some((r) => pathname.startsWith(r));
}
