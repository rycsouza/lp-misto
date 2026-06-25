import { getDb } from "@/lib/db/client";
import { tickets, orderItems, orders } from "@/lib/db/schema";
import { and, eq, asc } from "drizzle-orm";

export interface OrderTicket {
  id: string;
  gameId: string;
  typeCode: string;
  typeName: string;
  unitPriceCents: number;
  status: "valid" | "validated" | "cancelled";
  validatedAt: string | null;
  validatedBy: string | null;
  /** Token JWT assinado para uso no QR Code — gerado server-side no momento da exibição. */
  qrToken?: string;
}

function typeNameFromMeta(meta: Record<string, unknown> | null, code: string): string {
  const name = meta?.typeName as string | undefined;
  if (name) return name;
  if (code === "meia") return "Meia-entrada";
  if (code === "inteira") return "Inteira";
  return code.charAt(0).toUpperCase() + code.slice(1);
}

/**
 * Garante que os ingressos individuais do pedido existem (um por unidade),
 * gerados a partir das linhas de ingresso do pedido. Idempotente: não recria
 * se já houver ingressos. Use após o pagamento e ao exibir os pedidos do cliente.
 */
export async function ensureTicketsForOrder(orderId: string): Promise<OrderTicket[]> {
  const db = await getDb();
  try {
    const existing = await readTickets(orderId);
    if (existing.length > 0) return existing;

    const [order] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!order || order.status !== "paid") return [];

    const lines = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.orderId, orderId), eq(orderItems.type, "ticket")));

    const rows: (typeof tickets.$inferInsert)[] = [];
    for (const line of lines) {
      const meta = (line.metadata as Record<string, unknown>) ?? null;
      if (meta?.isCouponDiscount) continue;
      if (!line.referenceId || line.unitPriceCents < 0) continue;
      const code = (meta?.ticketType as string) ?? "inteira";
      const typeName = typeNameFromMeta(meta, code);
      for (let i = 0; i < line.quantity; i++) {
        rows.push({
          orderId,
          gameId: line.referenceId,
          typeCode: code,
          typeName,
          unitPriceCents: line.unitPriceCents,
          status: "valid",
        });
      }
    }

    if (rows.length === 0) return [];
    await db.insert(tickets).values(rows);
    return readTickets(orderId);
  } catch {
    // tabela ainda não migrada / erro transitório → não quebra o fluxo
    return [];
  }
}

export async function readTickets(orderId: string): Promise<OrderTicket[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(tickets)
    .where(eq(tickets.orderId, orderId))
    .orderBy(asc(tickets.createdAt));
  return rows.map((r) => ({
    id: r.id,
    gameId: r.gameId,
    typeCode: r.typeCode,
    typeName: r.typeName,
    unitPriceCents: r.unitPriceCents,
    status: r.status as OrderTicket["status"],
    validatedAt: r.validatedAt ? (r.validatedAt as Date).toISOString() : null,
    validatedBy: r.validatedBy ?? null,
  }));
}
