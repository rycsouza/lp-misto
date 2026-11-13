import { getDb } from "@/lib/db/client";
import { coupons, couponUsages } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

/**
 * Registra o uso de um cupom (interno — chamado pelo checkout no servidor após
 * criar o pedido). NÃO é server action: expor isto como endpoint público
 * permitiria a qualquer um inflar `usageCount` e exaurir o `maxUsages` de um cupom.
 *
 * O limite é reservado ATOMICAMENTE (UPDATE condicional `usage_count < max_usages`):
 * duas compras simultâneas não passam do limite. Sem vaga → false, e quem chama
 * cancela o pedido antes de cobrar. O uso é devolvido por `releaseCouponUsage` quando
 * o pedido falha, expira, é cancelado ou estornado (auditoria run-2).
 */
export async function recordCouponUsage(
  couponId: string,
  orderId: string,
  customerId: string,
  discountAppliedCents: number
): Promise<boolean> {
  const db = await getDb();
  const claimed = await db
    .update(coupons)
    .set({ usageCount: sql`${coupons.usageCount} + 1` })
    .where(
      and(
        eq(coupons.id, couponId),
        sql`(${coupons.maxUsages} IS NULL OR ${coupons.usageCount} < ${coupons.maxUsages})`
      )
    )
    .returning({ id: coupons.id });
  if (claimed.length === 0) return false;
  await db.insert(couponUsages).values({
    couponId,
    orderId,
    customerId,
    discountAppliedCents,
  });
  return true;
}

/**
 * Devolve o uso de cupom de um pedido que não vingou. Chamado por `restoreOrderStock`
 * depois do claim `stock_restored`, que garante execução única por pedido.
 */
export async function releaseCouponUsage(orderId: string): Promise<void> {
  const db = await getDb();
  const released = await db
    .delete(couponUsages)
    .where(eq(couponUsages.orderId, orderId))
    .returning({ couponId: couponUsages.couponId });
  for (const r of released) {
    await db
      .update(coupons)
      .set({ usageCount: sql`GREATEST(0, ${coupons.usageCount} - 1)` })
      .where(eq(coupons.id, r.couponId));
  }
}
