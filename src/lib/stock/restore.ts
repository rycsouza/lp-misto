import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { orders, orderItems, products, productVariants } from "@/lib/db/schema";

interface ProductLineMeta {
  variantId?: string | null;
}

export interface StockRestoreOp {
  variantId: string | null;
  productId: string;
  quantity: number;
}

/**
 * Decide o que devolver ao estoque a partir dos itens `type="product"` do pedido.
 * Linhas de desconto/upsell (sem `referenceId`) são ignoradas. Pura e exportada
 * para teste. A restrição "stock não-nulo" (ilimitado) é aplicada no SQL.
 */
export function planStockRestore(
  items: { referenceId: string | null; quantity: number; metadata: unknown }[]
): StockRestoreOp[] {
  const ops: StockRestoreOp[] = [];
  for (const it of items) {
    if (!it.referenceId) continue; // desconto/upsell — não é produto real
    const variantId = (it.metadata as ProductLineMeta | null)?.variantId ?? null;
    ops.push({ variantId, productId: it.referenceId, quantity: it.quantity });
  }
  return ops;
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

  for (const op of planStockRestore(items)) {
    if (op.variantId) {
      await db
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} + ${op.quantity}` })
        .where(and(eq(productVariants.id, op.variantId), sql`${productVariants.stock} IS NOT NULL`));
    } else {
      await db
        .update(products)
        .set({ stock: sql`${products.stock} + ${op.quantity}` })
        .where(and(eq(products.id, op.productId), sql`${products.stock} IS NOT NULL`));
    }
  }
}
