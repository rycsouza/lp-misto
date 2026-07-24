import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { orders, orderItems, products, productVariants } from "@/lib/db/schema";

interface ProductLineMeta {
  variantId?: string | null;
}

/**
 * Devolve ao pool o estoque de produto consumido por um pedido (o estoque é
 * debitado na CRIAÇÃO, antes do pagamento). Chamado quando o pedido não vinga:
 * expiração, cancelamento ou estorno.
 *
 * EXATAMENTE UMA VEZ: o claim atômico `UPDATE ... WHERE stock_restored = false
 * RETURNING` garante que só um chamador execute a devolução — estorno manual e
 * webhook de estorno podem disparar juntos sem inflar o estoque (o que causaria
 * oversell). Itens sem estoque rastreado (`stock IS NULL` = ilimitado) e linhas
 * de desconto/upsell (sem `referenceId`) são ignorados.
 */
export async function restoreOrderStock(orderId: string): Promise<void> {
  const db = await getDb();

  const claimed = await db
    .update(orders)
    .set({ stockRestored: true })
    .where(and(eq(orders.id, orderId), eq(orders.stockRestored, false)))
    .returning({ id: orders.id });
  if (claimed.length === 0) return; // já devolvido por outro caminho

  const items = await db
    .select({ referenceId: orderItems.referenceId, quantity: orderItems.quantity, metadata: orderItems.metadata })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), eq(orderItems.type, "product")));

  for (const it of items) {
    if (!it.referenceId) continue; // linha de desconto/upsell — não é produto real
    const variantId = (it.metadata as ProductLineMeta | null)?.variantId ?? null;
    if (variantId) {
      await db
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} + ${it.quantity}` })
        .where(and(eq(productVariants.id, variantId), sql`${productVariants.stock} IS NOT NULL`));
    } else {
      await db
        .update(products)
        .set({ stock: sql`${products.stock} + ${it.quantity}` })
        .where(and(eq(products.id, it.referenceId), sql`${products.stock} IS NOT NULL`));
    }
  }
}
