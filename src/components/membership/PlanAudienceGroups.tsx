import { Fragment, type ReactNode } from "react";
import {
  PLAN_AUDIENCES,
  PLAN_GROUP_SUBTITLE,
  PLAN_GROUP_TITLE,
  groupPlansByAudience,
  type PlanAudience,
} from "@/lib/membership/plan-audience";

/**
 * Planos separados por público: "Planos para você" (CPF) e, abaixo, "Planos para empresas"
 * (CNPJ). Grupo sem planos não mostra título. Sem estado: serve a server e client components.
 */
export function PlanAudienceGroups<T extends { id: string; audience: PlanAudience }>({
  plans,
  gridClassName,
  itemClassName,
  renderPlan,
  align = "center",
}: {
  plans: readonly T[];
  /** Classes do contêiner de cada grupo (ex.: flex-wrap centralizado). */
  gridClassName: string;
  /**
   * Classes de cada item (largura por tamanho de tela). Com flex-wrap + justify-center,
   * uma linha incompleta (ex.: 3 planos numa linha de 4) fica CENTRALIZADA — no grid ela
   * ficava encostada à esquerda.
   */
  itemClassName?: string;
  renderPlan: (plan: T) => ReactNode;
  align?: "center" | "start";
}) {
  const groups = groupPlansByAudience(plans);
  const alignClass = align === "center" ? "text-center" : "text-left";

  return (
    <div className="flex flex-col gap-12">
      {PLAN_AUDIENCES.map((audience) => {
        const list = groups[audience];
        if (list.length === 0) return null;
        const subtitle = PLAN_GROUP_SUBTITLE[audience];
        const headingId = `planos-${audience}`;
        return (
          <section key={audience} aria-labelledby={headingId} className="flex flex-col gap-6">
            <div className={alignClass}>
              <h3
                id={headingId}
                className="font-[family-name:var(--font-bebas-neue)] text-2xl sm:text-3xl text-foreground"
              >
                {PLAN_GROUP_TITLE[audience]}
              </h3>
              {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
            </div>
            <div className={gridClassName}>
              {list.map((plan) =>
                itemClassName ? (
                  <div key={plan.id} className={itemClassName}>
                    {renderPlan(plan)}
                  </div>
                ) : (
                  <Fragment key={plan.id}>{renderPlan(plan)}</Fragment>
                )
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
