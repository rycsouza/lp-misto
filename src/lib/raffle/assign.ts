import { getDb } from "@/lib/db/client";
import { raffleNumbers } from "@/lib/db/schema";
import { and, eq, ne } from "drizzle-orm";

/**
 * Confirma os números reservados de um pedido pago: reserved → sold.
 * Idempotente: se já estão sold (ou não há reservados), não faz nada.
 * Chamado no bloco `paid` de applyGatewayStatus (uma vez por transição real).
 */
export async function assignRaffleNumbers(orderId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(raffleNumbers)
    .set({ status: "sold", assignedAt: new Date(), reservedUntil: null })
    .where(and(eq(raffleNumbers.orderId, orderId), eq(raffleNumbers.status, "reserved")));
}

/**
 * Libera os números de um pedido que não se concretizou (PIX expirado/falho,
 * cancelado ou reembolsado): volta pro pool como `available`, soltando o vínculo.
 * Cobre reserved (nunca pago) e sold (pago e depois estornado).
 */
export async function releaseRaffleNumbers(orderId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(raffleNumbers)
    .set({ status: "available", orderId: null, reservedUntil: null, assignedAt: null })
    .where(and(eq(raffleNumbers.orderId, orderId), ne(raffleNumbers.status, "available")));
}
