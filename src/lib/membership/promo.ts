/**
 * Promoção "1º mês grátis" do sócio-torcedor (só cartão, só Asaas). Funções
 * PURAS: nada aqui toca banco nem gateway. Quem chama já trouxe o plano, o método
 * de pagamento, o gateway, o histórico de uso (e-mail/CPF) e a data de hoje em
 * Brasília. Regras de exibição do selo ficam em plan-benefits.ts.
 */
import { isFirstMonthPromoActive } from "./plan-benefits";

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Soma um mês a "AAAA-MM-DD" no calendário (a data já é de Brasília).
 * Dia que não existe no mês seguinte → último dia desse mês
 * (31/01 → 28/02, ou 29/02 em ano bissexto).
 */
export function addOneMonthBrasilia(dateOnly: string): string {
  const m = DATE_ONLY_RE.exec(dateOnly);
  if (!m) throw new Error(`Data inválida: ${dateOnly}`);
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12 (mês de origem)
  const day = Number(m[3]);
  // Date.UTC normaliza mês 13 → janeiro do ano seguinte.
  const lastDayOfNext = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const target = new Date(Date.UTC(year, month, Math.min(day, lastDayOfNext)));
  return target.toISOString().slice(0, 10);
}

/** Só o gateway Asaas tem promoção (Mercado Pago não). */
export function promoAppliesToGateway(gatewaySlug: string | null | undefined): boolean {
  return !!gatewaySlug && gatewaySlug.startsWith("asaas");
}

export type PromoDecision =
  /** Sem promoção: cobra hoje, como adesão normal. */
  | { action: "none" }
  /** 1º mês grátis: assinatura com a 1ª cobrança em `firstDueDate`. */
  | { action: "apply"; firstDueDate: string }
  /** Promoção existiria, mas já foi usada e o cliente não confirmou a cobrança cheia. Não cria assinatura. */
  | { action: "blocked" }
  /** Promoção já usada e o cliente confirmou a cobrança cheia hoje. */
  | { action: "full_price_after_use" };

export interface PromoDecisionInput {
  plan: { firstMonthFree: boolean; promoEndsAt: Date | string | null };
  paymentMethod: "card" | "pix";
  gatewaySlug: string | null;
  /** Nunca teve mês grátis nem mensalidade paga (checado por e-mail e CPF). */
  eligible: boolean;
  /** O cliente confirmou pagar a mensalidade cheia caso a promoção já tenha sido usada. */
  acceptFullPriceIfUnavailable: boolean;
  /** Hoje em Brasília (AAAA-MM-DD). */
  today: string;
  now?: Date;
}

/** Há promoção a considerar? (vigente + cartão + gateway Asaas). Use antes de consultar elegibilidade. */
export function isPromoCandidate(input: Omit<PromoDecisionInput, "eligible" | "acceptFullPriceIfUnavailable" | "today">): boolean {
  return (
    isFirstMonthPromoActive(input.plan, input.now) &&
    input.paymentMethod === "card" &&
    promoAppliesToGateway(input.gatewaySlug)
  );
}

/** Decide a adesão com ou sem o 1º mês grátis. Pura: o chamador faz as consultas. */
export function decidePromo(input: PromoDecisionInput): PromoDecision {
  if (!isPromoCandidate(input)) return { action: "none" };
  if (!input.eligible) {
    return input.acceptFullPriceIfUnavailable ? { action: "full_price_after_use" } : { action: "blocked" };
  }
  return { action: "apply", firstDueDate: addOneMonthBrasilia(input.today) };
}

/**
 * Texto "Mês grátis até dd/mm" para a lista/detalhe do admin: só enquanto o mês
 * grátis está em curso (trialEndsAt no futuro) e não houve mensalidade paga.
 */
export function freeMonthUntilLabel(
  member: { trialEndsAt: Date | string | null; hasPaid: boolean },
  now: Date = new Date()
): string | null {
  if (!member.trialEndsAt || member.hasPaid) return null;
  const end = member.trialEndsAt instanceof Date ? member.trialEndsAt : new Date(member.trialEndsAt);
  if (Number.isNaN(end.getTime()) || end.getTime() <= now.getTime()) return null;
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(end);
  return `Mês grátis até ${parts}`;
}
