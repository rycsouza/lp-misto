import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { cantinaItems } from "@/lib/db/schema";

/**
 * Devolve ao pool unidades vendidas de um item da cantina (`stock_sold`, debitado na
 * criação do pedido). GREATEST evita negativo. Item sem limite (`stock_cap` NULL)
 * também é ajustado — o contador fica fiel caso o admin ponha um limite depois.
 */
export async function releaseCantinaStock(itemId: string, quantity: number): Promise<void> {
  if (!Number.isInteger(quantity) || quantity <= 0) return;
  const db = await getDb();
  await db
    .update(cantinaItems)
    .set({ stockSold: sql`GREATEST(0, ${cantinaItems.stockSold} - ${quantity})` })
    .where(eq(cantinaItems.id, itemId));
}
