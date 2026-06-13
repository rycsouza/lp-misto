"use server";

import { db } from "@/lib/db/client";
import { coupons, couponUsages, customers } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export interface CouponValidation {
  valid: true;
  couponId: string;
  code: string;
  description: string | null;
  discountType: "pct" | "fixed";
  discountValue: number;
  discountCents: number;
}

export type CouponResult =
  | CouponValidation
  | { valid: false; error: string };

export async function validateCoupon(
  code: string,
  totalCents: number,
  customerWhatsapp: string
): Promise<CouponResult> {
  if (!code.trim()) return { valid: false, error: "Código inválido" };

  const [coupon] = await db
    .select()
    .from(coupons)
    .where(eq(sql`upper(${coupons.code})`, code.trim().toUpperCase()))
    .limit(1);

  if (!coupon) return { valid: false, error: "Cupom não encontrado" };
  if (!coupon.active) return { valid: false, error: "Cupom inativo" };
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return { valid: false, error: "Cupom expirado" };
  if (coupon.minOrderCents > 0 && totalCents < coupon.minOrderCents) {
    const min = (coupon.minOrderCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return { valid: false, error: `Pedido mínimo de ${min} para este cupom` };
  }
  if (coupon.maxUsages != null && coupon.usageCount >= coupon.maxUsages) {
    return { valid: false, error: "Cupom esgotado" };
  }

  if (coupon.maxUsagesPerCustomer != null) {
    const [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.whatsapp, customerWhatsapp))
      .limit(1);

    if (customer) {
      const usages = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(couponUsages)
        .where(
          sql`${couponUsages.couponId} = ${coupon.id} AND ${couponUsages.customerId} = ${customer.id}`
        );
      if ((usages[0]?.count ?? 0) >= coupon.maxUsagesPerCustomer) {
        return { valid: false, error: "Você já utilizou este cupom" };
      }
    }
  }

  const discountCents =
    coupon.discountType === "pct"
      ? Math.round(totalCents * coupon.discountValue / 100)
      : Math.min(coupon.discountValue, totalCents);

  return {
    valid: true,
    couponId: coupon.id,
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType as "pct" | "fixed",
    discountValue: coupon.discountValue,
    discountCents,
  };
}

export async function recordCouponUsage(
  couponId: string,
  orderId: string,
  customerId: string,
  discountAppliedCents: number
): Promise<void> {
  await db.insert(couponUsages).values({
    couponId,
    orderId,
    customerId,
    discountAppliedCents,
  });
  await db
    .update(coupons)
    .set({ usageCount: sql`${coupons.usageCount} + 1` })
    .where(eq(coupons.id, couponId));
}
