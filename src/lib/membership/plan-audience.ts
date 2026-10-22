/**
 * Público do plano de sócio: pessoa física (CPF) ou empresa (CNPJ). Define o documento
 * da adesão e em qual seção da vitrine o plano aparece. Módulo PURO, seguro no client.
 * A fonte da verdade é o plano escolhido no servidor; nunca uma flag enviada pelo client.
 */

export const PLAN_AUDIENCES = ["pf", "pj"] as const;
export type PlanAudience = (typeof PLAN_AUDIENCES)[number];

export function isPlanAudience(value: unknown): value is PlanAudience {
  return typeof value === "string" && (PLAN_AUDIENCES as readonly string[]).includes(value);
}

/** Rótulo do tipo do plano no admin (formulário e selo da lista). */
export const PLAN_AUDIENCE_LABEL: Record<PlanAudience, string> = {
  pf: "Pessoa física (CPF)",
  pj: "Empresa (CNPJ)",
};

/** Títulos das seções da vitrine e do passo de escolha do wizard. */
export const PLAN_GROUP_TITLE: Record<PlanAudience, string> = {
  pf: "Planos para você",
  pj: "Planos para empresas",
};

export const PLAN_GROUP_SUBTITLE: Record<PlanAudience, string | null> = {
  pf: null,
  pj: "Para CNPJ: divulgação da marca e benefícios para a empresa",
};

/**
 * Separa os planos por público, mantendo a ordem recebida. Um grupo sem planos vem
 * vazio: quem renderiza não mostra o título desse grupo.
 */
export function groupPlansByAudience<T extends { audience: PlanAudience }>(
  plans: readonly T[]
): Record<PlanAudience, T[]> {
  const groups: Record<PlanAudience, T[]> = { pf: [], pj: [] };
  for (const plan of plans) groups[plan.audience].push(plan);
  return groups;
}
