/**
 * Plano de sócio PADRÃO do clube: o que o wizard de adesão abre quando o link não traz
 * ?plano (mural "Seu lugar", menu, CTAs genéricos). Chave `membershipDefaultPlanId` da
 * configuração (siteConfig) — o valor é o uuid do plano.
 *
 * Gravada SÓ por setDefaultMembershipPlan (admin-growth.ts). Fora do updateConfigValues
 * genérico, que recusa a chave (ver src/lib/admin/config-keys.ts).
 *
 * Módulo puro (sem I/O e sem "use server"): usado pela página de adesão no servidor e
 * pelos testes. A decisão é tomada no servidor; o cliente recebe só o slug resolvido.
 */

export const MEMBERSHIP_DEFAULT_PLAN_KEY = "membershipDefaultPlanId";

/** Campos do plano necessários para decidir (a lista vem de getPublicMembershipPlans: só ativos). */
export interface DefaultPlanCandidate {
  id: string;
  slug: string;
}

/**
 * Slug do plano padrão, SE ele estiver entre os planos recebidos (públicos e ativos).
 * Padrão inativo, excluído ou valor não-texto → null (sem erro: o chamador cai no fallback).
 */
export function resolveDefaultPlanSlug(
  plans: readonly DefaultPlanCandidate[],
  configValue: unknown
): string | null {
  if (typeof configValue !== "string" || configValue.length === 0) return null;
  return plans.find((plan) => plan.id === configValue)?.slug ?? null;
}

/**
 * Slug com que o wizard abre. Ordem: ?plano válido (slug entre os planos) vence;
 * senão, o plano padrão; senão, null (o wizard usa o primeiro plano, como antes).
 */
export function resolveInitialPlanSlug(
  plans: readonly DefaultPlanCandidate[],
  requestedSlug: unknown,
  configValue: unknown
): string | null {
  if (typeof requestedSlug === "string") {
    const requested = plans.find((plan) => plan.slug === requestedSlug);
    if (requested) return requested.slug;
  }
  return resolveDefaultPlanSlug(plans, configValue);
}
