import { randomInt } from "crypto";
import { and, eq, ne, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { orders, orderItems } from "@/lib/db/schema";

/**
 * Indica se um pedido é de retirada (não tem endereço de envio) e contém
 * ao menos um produto físico — ou seja, qualifica para gerar código de retirada.
 */
export async function isPickupOrder(orderId: string): Promise<boolean> {
  const db = await getDb();
  const [order] = await db
    .select({ status: orders.status, shippingAddress: orders.shippingAddress })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order || order.status !== "paid") return false;
  if (order.shippingAddress) return false; // tem envio → não é retirada
  const [productItem] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), eq(orderItems.type, "product")))
    .limit(1);
  return !!productItem;
}

/** Gera um código numérico de 6 dígitos (estilo iFood/Mercado Livre). */
function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Verifica se o código já está em uso por outro pedido ainda não retirado. */
async function codeInUse(code: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.pickupCode, code), ne(orders.fulfillmentStatus, "delivered")))
    .limit(1);
  return !!row;
}

/**
 * Garante que o pedido de retirada tenha um código de validação.
 * Idempotente: devolve o código existente se já houver. Gera um código único
 * (entre pedidos não retirados) sob demanda. Devolve null se o pedido não
 * qualifica (não é retirada / não está pago / sem produto físico).
 */
export async function ensurePickupCode(orderId: string): Promise<string | null> {
  try {
    const db = await getDb();
    const [order] = await db
      .select({ pickupCode: orders.pickupCode })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!order) return null;
    if (order.pickupCode) return order.pickupCode;

    if (!(await isPickupOrder(orderId))) return null;

    // Tenta gerar um código único; em colisão (rara) tenta de novo.
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateCode();
      if (await codeInUse(code)) continue;
      // Só grava se ainda estiver nulo (evita corrida entre requisições concorrentes).
      const updated = await db
        .update(orders)
        .set({ pickupCode: code })
        .where(and(eq(orders.id, orderId), isNull(orders.pickupCode)))
        .returning({ pickupCode: orders.pickupCode });
      if (updated.length > 0) return updated[0].pickupCode;
      // Outra requisição gravou primeiro → relê e devolve o código vencedor.
      const [fresh] = await db
        .select({ pickupCode: orders.pickupCode })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      if (fresh?.pickupCode) return fresh.pickupCode;
    }
    return null;
  } catch {
    // tabela ainda não migrada / erro transitório → não quebra o fluxo do cliente
    return null;
  }
}

/** Normaliza um código digitado pelo operador (remove tudo que não for dígito). */
export function normalizePickupCode(raw: string): string {
  return (raw || "").replace(/\D/g, "").slice(0, 6);
}
