import { headers } from "next/headers";
import { getTenantContextSlug } from "@/app/actions/platform-tenants";
import { getDisabledFeatures, getOrgIdBySlug } from "@/lib/platform/features";
import { featureForModule } from "@/lib/platform/module-features";

/** Mensagem lançada quando a feature do módulo está desligada para o clube. */
export const MODULE_DISABLED_MESSAGE = "Módulo desativado para este clube.";

/**
 * Clube (orgId) cujas features valem nesta requisição. Mesma precedência do
 * getDb (src/lib/db/client.ts): contexto de admin do SISTEMA (cookie de contexto
 * válido, só existe com sessão de plataforma) vence o tenant do host (x-org-id).
 * Assim o kill-switch é consultado para o MESMO clube cujo banco será usado.
 */
async function resolveRequestOrgId(): Promise<string | null> {
  const ctxSlug = await getTenantContextSlug();
  if (ctxSlug) return getOrgIdBySlug(ctxSlug);
  return (await headers()).get("x-org-id");
}

/**
 * Kill-switch NO SERVIDOR. Lança MODULE_DISABLED_MESSAGE se a feature que governa
 * o módulo estiver desligada para o clube em contexto (override do clube > flag
 * global). Chamado por `requireModule`, depois da checagem de permissão.
 *
 * - Vale para TODOS, inclusive admin do sistema: desligar é decisão de plataforma.
 * - NÃO bloqueia religar: as ações de flag (src/app/actions/platform-features.ts)
 *   dependem só de getPlatformSession, nunca de requireModule.
 * - Módulo sem feature mapeada → no-op (comportamento anterior).
 * - Sem PLATFORM_DATABASE_URL não há kill-switch (mesmo fail-open do painel).
 * - Erro de leitura do platform DB → fail-open com log (ver getDisabledFeatures).
 *   Erros inesperados desta própria checagem propagam (fail-closed).
 */
export async function assertModuleEnabledForClub(moduleKey: string): Promise<void> {
  const feature = featureForModule(moduleKey);
  if (!feature) return;
  if (!process.env.PLATFORM_DATABASE_URL) return;

  const orgId = await resolveRequestOrgId();
  const disabled = await getDisabledFeatures(orgId);
  if (disabled.has(feature)) throw new Error(MODULE_DISABLED_MESSAGE);
}
