"use server";

import { z } from "zod";
import { db } from "@/lib/db/client";
import { orders, orderItems, payments } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getPaymentGateway } from "@/lib/payment";
import { sendOrderConfirmation } from "@/lib/email";

const buyerSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  email: z.email("E-mail inválido"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
  _hp: z.string().optional(),
});

interface TicketItem {
  gameId: string;
  type: "inteira" | "meia";
  quantity: number;
  unitPriceCents: number;
}

interface CreateOrderInput {
  buyer: { name: string; email: string; whatsapp: string };
  tickets: TicketItem[];
}

interface CreateOrderResult {
  success: boolean;
  orderId?: string;
  paymentId?: string;
  pixQrCode?: string;
  pixQrCodeUrl?: string;
  error?: string;
}

export async function createOrder(
  input: CreateOrderInput
): Promise<CreateOrderResult> {
  const parsed = buyerSchema.safeParse(input.buyer);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const totalCents = input.tickets.reduce(
    (acc, t) => acc + t.quantity * t.unitPriceCents,
    0
  );

  try {
    const [order] = await db
      .insert(orders)
      .values({
        customerName: parsed.data.name,
        customerEmail: parsed.data.email,
        customerWhatsapp: parsed.data.whatsapp,
        totalCents,
        status: "pending",
      })
      .returning();

    type ItemInsert = {
      orderId: string;
      type: "ticket" | "product" | "raffle";
      referenceId?: string | null;
      quantity: number;
      unitPriceCents: number;
      metadata?: Record<string, unknown> | null;
    };

    const itemsToInsert: ItemInsert[] = input.tickets.map((t) => ({
      orderId: order.id,
      type: "ticket" as const,
      referenceId: t.gameId,
      quantity: t.quantity,
      unitPriceCents: t.unitPriceCents,
      metadata: { ticketType: t.type },
    }));

    await db.insert(orderItems).values(itemsToInsert);

    const gateway = await getPaymentGateway();
    const result = await gateway.createPayment({
      orderId: order.id,
      amountCents: totalCents,
      customerName: parsed.data.name,
      customerEmail: parsed.data.email,
      description: `Ingresso Misto EC — Pedido #${order.id.slice(0, 8)}`,
    });

    const [payment] = await db
      .insert(payments)
      .values({
        orderId: order.id,
        gatewaySlug: "asaas",
        gatewayPaymentId: result.gatewayPaymentId,
        status: "pending",
        amountCents: totalCents,
        pixQrCode: result.pixQrCode,
        pixQrCodeUrl: result.pixQrCodeUrl ?? null,
      })
      .returning();

    return {
      success: true,
      orderId: order.id,
      paymentId: payment.id,
      pixQrCode: result.pixQrCode,
      pixQrCodeUrl: result.pixQrCodeUrl,
    };
  } catch (err) {
    console.error("createOrder error:", err);
    return { success: false, error: "Erro ao processar pedido. Tente novamente." };
  }
}

export async function checkPaymentStatus(
  paymentId: string
): Promise<"pending" | "paid" | "failed" | "refunded"> {
  try {
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!rows[0]) return "pending";

    if (rows[0].status !== "pending") {
      return rows[0].status as "pending" | "paid" | "failed" | "refunded";
    }

    if (rows[0].gatewayPaymentId) {
      const gateway = await getPaymentGateway();
      const status = await gateway.getPaymentStatus(rows[0].gatewayPaymentId);
      if (status !== "pending") {
        await db
          .update(payments)
          .set({ status, paidAt: status === "paid" ? new Date() : undefined })
          .where(eq(payments.id, paymentId));
        if (status === "paid") {
          await db
            .update(orders)
            .set({ status: "paid" })
            .where(eq(orders.id, rows[0].orderId));
          sendOrderConfirmation(rows[0].orderId).catch((err) =>
            console.error("[email] Falha ao enviar confirmação:", err)
          );
        }
      }
      return status;
    }

    return rows[0].status as "pending" | "paid" | "failed" | "refunded";
  } catch (err) {
    console.error("checkPaymentStatus error:", err);
    return "pending";
  }
}

interface LookupResult {
  found: boolean;
  name?: string;
  email?: string;
  maskedName?: string;
  maskedEmail?: string;
}

export async function lookupCustomer(whatsappDigits: string): Promise<LookupResult> {
  try {
    const rows = await db
      .select({ name: orders.customerName, email: orders.customerEmail })
      .from(orders)
      .where(
        sql`regexp_replace(${orders.customerWhatsapp}, '[^0-9]', '', 'g') = ${whatsappDigits}`
      )
      .orderBy(desc(orders.createdAt))
      .limit(1);

    if (!rows[0]) return { found: false };

    const { name, email } = rows[0];

    const firstName = name.split(" ")[0];
    const maskedName = name.split(" ").length > 1 ? `${firstName} ***` : firstName;

    const [localPart, domain] = email.split("@");
    const visibleLocal = localPart.slice(0, Math.min(4, localPart.length));
    const maskedEmail = `${visibleLocal}***@${domain}`;

    return { found: true, name, email, maskedName, maskedEmail };
  } catch (err) {
    console.error("lookupCustomer error:", err);
    return { found: false };
  }
}
