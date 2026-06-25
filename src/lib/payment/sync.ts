import { getDb } from "@/lib/db/client";
import { payments, orders } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { sendOrderConfirmation } from "@/lib/email";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

/**
 * Máquina de estados direcional: a partir de qual status atual é permitido
 * transicionar para a chave. O gateway (ASAAS) é a fonte da verdade, mas um
 * pagamento já `paid`/`refunded` NUNCA pode ser rebaixado para `failed` — isso
 * evita que um timeout local ou um evento atrasado sobrescreva um pagamento
 * realmente confirmado. A correção `failed → paid` é permitida (reconciliação).
 */
const ALLOWED_FROM: Record<PaymentStatus, PaymentStatus[]> = {
  paid: ["pending", "failed"],
  refunded: ["pending", "paid"],
  failed: ["pending"],
  pending: [],
};

const ORDER_STATUS: Record<PaymentStatus, "paid" | "cancelled" | "refunded" | null> = {
  paid: "paid",
  failed: "cancelled",
  refunded: "refunded",
  pending: null,
};

/**
 * Aplica ao pagamento um status vindo do gateway de forma **idempotente** e
 * **direcional**. Só grava se a transição for permitida por `ALLOWED_FROM`,
 * usando o status atual no próprio `WHERE` para evitar race conditions
 * (last-write-wins). Os efeitos colaterais (e-mail de confirmação, comissão de
 * afiliado) disparam apenas na transição real para `paid`.
 *
 * @returns `true` se o registro foi efetivamente atualizado; `false` em no-op.
 */
export async function applyGatewayStatus(
  paymentId: string,
  orderId: string,
  newStatus: PaymentStatus
): Promise<boolean> {
  const db = await getDb();
  const allowedFrom = ALLOWED_FROM[newStatus];
  if (allowedFrom.length === 0) return false;

  const updated = await db
    .update(payments)
    .set({
      status: newStatus,
      paidAt: newStatus === "paid" ? new Date() : undefined,
    })
    .where(and(eq(payments.id, paymentId), inArray(payments.status, allowedFrom)))
    .returning({ id: payments.id });

  // No-op: o pagamento já estava num estado terminal incompatível
  // (ex.: tentar marcar `failed` sobre um `paid`).
  if (updated.length === 0) return false;

  const orderStatus = ORDER_STATUS[newStatus];
  if (orderStatus) {
    await db.update(orders).set({ status: orderStatus }).where(eq(orders.id, orderId));
  }

  if (newStatus === "paid") {
    // Gera os ingressos individuais (1 QR por ingresso) assim que o pedido é pago
    const { ensureTicketsForOrder } = await import("@/lib/tickets/generate");
    await ensureTicketsForOrder(orderId).catch((err) =>
      console.error("[tickets] Falha ao gerar ingressos:", err)
    );
    sendOrderConfirmation(orderId).catch((err) =>
      console.error("[email] Falha ao enviar confirmação:", err)
    );
    const { confirmAffiliateReferral } = await import("@/app/actions/affiliates");
    confirmAffiliateReferral(orderId).catch((err) =>
      console.error("[affiliate] Falha ao confirmar indicação:", err)
    );
  }

  return true;
}
