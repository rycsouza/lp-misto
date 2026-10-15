/**
 * Regras de preço de sócio PURAS (sem I/O e sem imports): usadas pelo servidor
 * do checkout (src/app/actions/checkout.ts) E pelo client, para o total mostrado
 * antes de pagar ser o mesmo que será cobrado. Não importar nada de Node aqui
 * (utils.ts traz "crypto" e não pode ir para o bundle do client).
 */

/** Percentuais do plano do sócio logado (nunca e-mail/ids). */
export interface MemberPricingPcts {
  ticketDiscountPct: number;
  productDiscountPct: number;
}

/** Desconto de sócio sobre uma base em centavos (arredonda, limita 0–100%). */
export function computeMemberDiscount(baseCents: number, discountPct: number): number {
  if (discountPct <= 0 || baseCents <= 0) return 0;
  const pct = Math.min(100, Math.max(0, discountPct));
  return Math.round((baseCents * pct) / 100);
}

/**
 * Desconto de sócio sobre o SUBTOTAL elegível (ingressos ou produtos — nunca o
 * upsell), igual ao servidor. `pricing` null (sem sessão/benefício) → 0.
 */
export function memberDiscountCents(
  pricing: MemberPricingPcts | null | undefined,
  kind: "tickets" | "products",
  eligibleCents: number
): number {
  if (!pricing) return 0;
  const pct = kind === "tickets" ? pricing.ticketDiscountPct : pricing.productDiscountPct;
  return computeMemberDiscount(eligibleCents, pct);
}

/** Preço de sócio de UMA unidade, para exibição na vitrine/produto/ingresso. */
export function memberUnitPriceCents(unitCents: number, discountPct: number): number {
  return unitCents - computeMemberDiscount(unitCents, discountPct);
}

/**
 * Total cobrado, na mesma ordem do servidor: subtotal − cupom − sócio −
 * automático (promoção ou combo, o que o servidor escolher), nunca abaixo de
 * zero, mais o frete (só produtos).
 */
export function checkoutTotalCents(p: {
  subtotalCents: number;
  couponDiscountCents?: number;
  memberDiscountCents?: number;
  autoDiscountCents?: number;
  shippingCents?: number;
}): number {
  const {
    subtotalCents,
    couponDiscountCents = 0,
    memberDiscountCents = 0,
    autoDiscountCents = 0,
    shippingCents = 0,
  } = p;
  return Math.max(0, subtotalCents - couponDiscountCents - memberDiscountCents - autoDiscountCents) + shippingCents;
}
