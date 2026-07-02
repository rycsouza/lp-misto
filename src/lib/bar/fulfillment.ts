import { getDb } from "@/lib/db/client";
import { orders, orderItems } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Ajuste de fulfillment de uma ficha de bar logo após o pagamento.
 *
 * - Sem nenhum item que precise de preparo (ex.: só cerveja) → nasce "ready"
 *   (pronta para retirada) imediatamente.
 * - Com item de preparo → permanece "pending" (em preparo) até a cozinha
 *   marcar pronta.
 *
 * No-op para pedidos que não têm itens de bar (ingressos/produtos).
 */
export async function ensureBarFulfillmentForOrder(orderId: string): Promise<void> {
  const db = await getDb();
  const items = await db
    .select({ metadata: orderItems.metadata })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), eq(orderItems.type, "bar")));

  if (items.length === 0) return; // não é ficha de bar

  const anyNeedsPrep = items.some(
    (i) => (i.metadata as { needsPrep?: boolean } | null)?.needsPrep === true
  );

  if (!anyNeedsPrep) {
    await db
      .update(orders)
      .set({ fulfillmentStatus: "ready" })
      .where(and(eq(orders.id, orderId), eq(orders.fulfillmentStatus, "pending")));
  }
}
