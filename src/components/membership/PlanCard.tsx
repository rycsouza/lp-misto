import type { CSSProperties, ReactNode } from "react";
import { Check } from "lucide-react";
import type { PublicPlan } from "@/app/actions/membership";
import {
  buildPlanBenefitLines,
  highlightLabelOf,
  promoUntilLabel,
  safeCardColor,
  type PlanBenefitLine,
} from "@/lib/membership/plan-benefits";

/** Dados já prontos para exibir (o cálculo fica em src/lib/membership/plan-benefits.ts). */
export interface PlanCardData {
  name: string;
  description: string | null;
  priceCents: number;
  highlight: boolean;
  highlightLabel?: string | null;
  cardColor?: string | null;
  /** Promoção "1º mês grátis" ativa (já considera a data-limite). */
  promoFirstMonthFree: boolean;
  /** "até dd/mm" quando a promoção tem data-limite. */
  promoUntil?: string | null;
  benefitLines: PlanBenefitLine[];
}

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Cartão de plano da vitrine (e da prévia no admin). Sem estado nem efeitos, para
 * rodar tanto em server quanto em client component.
 */
export function PlanCard({ plan, footer }: { plan: PlanCardData; footer?: ReactNode }) {
  const color = safeCardColor(plan.cardColor);
  // Cor do plano (quando definida) vale para borda e brilho; senão, a primária do clube.
  const accentStyle: CSSProperties | undefined = color
    ? {
        borderColor: color,
        boxShadow: plan.highlight ? `0 0 28px ${color}66` : undefined,
      }
    : undefined;

  return (
    <div
      className={`relative bg-card rounded-xl p-5 flex flex-col transition-transform ${
        plan.highlight
          ? "border-2 border-primary shadow-[0_0_28px_rgba(193,154,90,0.4)] lg:scale-105 z-10 ring-1 ring-primary/40"
          : "border border-border"
      }`}
      style={accentStyle}
    >
      {plan.highlight && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap bg-primary text-primary-foreground"
          style={color ? { backgroundColor: color } : undefined}
        >
          {highlightLabelOf(plan.highlightLabel)}
        </div>
      )}
      <div className="mb-4">
        <h3 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground">
          {plan.name}
        </h3>
        {plan.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
        )}
        <p className="text-primary font-bold text-xl mt-1">{formatBRL(plan.priceCents)}</p>
        <p className="text-xs text-muted-foreground">por mês</p>
        {plan.promoFirstMonthFree && (
          <span className="inline-flex mt-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600">
            1º mês grátis no cartão
            {plan.promoUntil ? ` · ${plan.promoUntil}` : ""}
          </span>
        )}
      </div>
      <ul className="space-y-2 flex-1 mb-6">
        {plan.benefitLines.map((line) => (
          <li key={line.key} className="flex items-start gap-2 text-xs text-muted-foreground">
            <Check size={14} className="text-primary mt-0.5 shrink-0" />
            {line.text}
          </li>
        ))}
      </ul>
      {footer}
    </div>
  );
}

/** Converte o plano público (vitrine) nos dados do cartão, com as regras de plan-benefits.ts. */
export function publicPlanToCardData(plan: PublicPlan): PlanCardData {
  return {
    name: plan.name,
    description: plan.description,
    priceCents: plan.priceCents,
    highlight: plan.highlight,
    highlightLabel: plan.highlightLabel,
    cardColor: plan.cardColor,
    promoFirstMonthFree: plan.promoFirstMonthFree,
    promoUntil: promoUntilLabel(plan.promoEndsAt),
    benefitLines: buildPlanBenefitLines(
      {
        ticketDiscountPct: plan.ticketDiscountPct,
        productDiscountPct: plan.productDiscountPct,
        freeTicketsPerHomeGame: plan.freeTicketsPerHomeGame,
      },
      plan.benefits
    ),
  };
}
