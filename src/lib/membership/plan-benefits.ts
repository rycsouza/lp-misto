/**
 * Regras de exibição dos planos de sócio, usadas igual na vitrine, no wizard de
 * adesão, na prévia do admin e (depois) na carteirinha. Funções puras: nada aqui
 * toca banco nem decide cobrança.
 */

export const DEFAULT_HIGHLIGHT_LABEL = "MAIS POPULAR";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Campos do plano que geram benefício automaticamente (não são linhas da tabela de benefícios). */
export interface PlanAutomaticBenefitSource {
  ticketDiscountPct: number;
  productDiscountPct: number;
  freeTicketsPerHomeGame: number;
}

export interface PlanBenefitItem {
  id: string;
  label: string;
  detail?: string | null;
}

export interface PlanBenefitLine {
  key: string;
  text: string;
  /** Veio dos campos do plano (desconto/ingresso), não da tabela de benefícios. */
  automatic: boolean;
}

/** Textos dos benefícios automáticos derivados dos campos do plano (zero = não aparece). */
export function automaticBenefitTexts(plan: PlanAutomaticBenefitSource): string[] {
  const out: string[] = [];
  if (plan.productDiscountPct > 0) {
    out.push(`${plan.productDiscountPct}% de desconto em produtos`);
  }
  if (plan.ticketDiscountPct > 0) {
    out.push(`${plan.ticketDiscountPct}% de desconto em ingressos`);
  }
  const n = plan.freeTicketsPerHomeGame;
  if (n > 0) {
    out.push(n === 1 ? "1 ingresso grátis por jogo em casa" : `${n} ingressos grátis por jogo em casa`);
  }
  return out;
}

/**
 * Lista final exibida: primeiro os automáticos (derivados do plano), depois os
 * benefícios incluídos. Com `detail`, o texto vira "Benefício: detalhe".
 */
export function buildPlanBenefitLines(
  plan: PlanAutomaticBenefitSource,
  benefits: PlanBenefitItem[]
): PlanBenefitLine[] {
  const automatic = automaticBenefitTexts(plan).map((text, i) => ({
    key: `auto-${i}`,
    text,
    automatic: true,
  }));
  const included = benefits.map((b) => {
    const detail = b.detail?.trim();
    return {
      key: b.id,
      text: detail ? `${b.label}: ${detail}` : b.label,
      automatic: false,
    };
  });
  return [...automatic, ...included];
}

/** Etiqueta do destaque: a configurada, ou o texto padrão se vazia/ausente. */
export function highlightLabelOf(label: string | null | undefined): string {
  const trimmed = label?.trim();
  return trimmed ? trimmed : DEFAULT_HIGHLIGHT_LABEL;
}

/** Cor do cartão só se for #RRGGBB válido (senão, null → cor primária do clube). */
export function safeCardColor(value: string | null | undefined): string | null {
  if (!value || !HEX_COLOR_RE.test(value)) return null;
  return value.toLowerCase();
}
