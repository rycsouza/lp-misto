/**
 * Regras de exibição dos planos de sócio, usadas igual na vitrine, no wizard de
 * adesão, na prévia do admin e (depois) na carteirinha. Funções puras: nada aqui
 * toca banco nem decide cobrança.
 */

export const DEFAULT_HIGHLIGHT_LABEL = "MAIS POPULAR";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

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

/** Promoção "1º mês grátis" vale enquanto estiver marcada e dentro da data-limite (se houver). */
export function isFirstMonthPromoActive(
  plan: { firstMonthFree: boolean; promoEndsAt: Date | string | null },
  now: Date = new Date()
): boolean {
  if (!plan.firstMonthFree) return false;
  if (!plan.promoEndsAt) return true;
  const end = plan.promoEndsAt instanceof Date ? plan.promoEndsAt : new Date(plan.promoEndsAt);
  return end.getTime() > now.getTime();
}

/** "até dd/mm" (fuso de Brasília) para o selo da promoção; null sem data-limite. */
export function promoUntilLabel(promoEndsAt: string | null): string | null {
  if (!promoEndsAt) return null;
  const date = new Date(promoEndsAt);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
  return `até ${parts}`;
}

/** "AAAA-MM-DD" (input type=date) → fim desse dia em Brasília (UTC-3, sem horário de verão desde 2019). */
export function endOfDaySaoPaulo(dateOnly: string): Date | null {
  if (!DATE_ONLY_RE.test(dateOnly)) return null;
  const y = Number(dateOnly.slice(0, 4));
  const mo = Number(dateOnly.slice(5, 7));
  const d = Number(dateOnly.slice(8, 10));
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return new Date(Date.UTC(y, mo - 1, d, 23, 59, 59) + 3 * 60 * 60 * 1000);
}

/** ISO do banco → "AAAA-MM-DD" do dia em Brasília (valor do input type=date). */
export function promoEndDateInputValue(promoEndsAt: string | null): string {
  if (!promoEndsAt) return "";
  const date = new Date(promoEndsAt);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}
