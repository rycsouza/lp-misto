export interface PromotionLike {
  discountType: "pct" | "fixed";
  discountValue: number;
  minOrderCents: number;
  active: boolean;
  startsAt: Date;
  endsAt: Date;
  flashSale: boolean;
}

export function isPromotionActive(promo: PromotionLike, now = new Date()): boolean {
  return promo.active && promo.startsAt <= now && promo.endsAt >= now;
}

export function computePromotionDiscount(
  subtotalCents: number,
  promo: Pick<PromotionLike, "discountType" | "discountValue" | "minOrderCents">
): number {
  if (subtotalCents < promo.minOrderCents) return 0;
  if (promo.discountType === "fixed") {
    return Math.min(promo.discountValue, subtotalCents);
  }
  const pct = Math.min(promo.discountValue, 100);
  return Math.round((subtotalCents * pct) / 100);
}

export function isFlashSale(promo: Pick<PromotionLike, "flashSale" | "endsAt">, now = new Date()): boolean {
  return promo.flashSale && promo.endsAt >= now;
}

export function flashSaleRemainingMs(endsAt: Date, now = new Date()): number {
  return Math.max(0, endsAt.getTime() - now.getTime());
}
