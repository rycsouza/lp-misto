import { getDb } from "@/lib/db/client";
import { coupons, couponUsages } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Registra o uso de um cupom (interno — chamado pelo checkout no servidor após
 * criar o pedido). NÃO é server action: expor isto como endpoint público
 * permitiria a qualquer um inflar `usageCount` e exaurir o `maxUsages` de um cupom.
 */
export async function recordCouponUsage(
  couponId: string,
  orderId: string,
  customerId: string,
  discountAppliedCents: number
): Promise<void> {
  const db = await getDb();
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
