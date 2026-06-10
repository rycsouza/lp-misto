import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { db } from "@/lib/db/client";
import { payments, orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const STATUS_MAP: Record<string, "pending" | "paid" | "failed" | "refunded"> = {
  RECEIVED: "paid",
  CONFIRMED: "paid",
  REFUNDED: "refunded",
  REFUND_REQUESTED: "refunded",
  OVERDUE: "failed",
  CHARGEBACK_REQUESTED: "failed",
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const signature = req.headers.get("asaas-signature") ?? req.headers.get("x-asaas-signature");

  if (process.env.ASAAS_WEBHOOK_TOKEN && signature) {
    const expected = createHmac("sha256", process.env.ASAAS_WEBHOOK_TOKEN)
      .update(body)
      .digest("hex");
    if (expected !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let event: { event: string; payment: { id: string; status: string; externalReference?: string } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const gatewayPaymentId = event.payment?.id;
  const rawStatus = event.payment?.status;
  const newStatus = STATUS_MAP[rawStatus];

  if (gatewayPaymentId && newStatus) {
    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.gatewayPaymentId, gatewayPaymentId))
      .limit(1);

    if (paymentRows[0]) {
      await db
        .update(payments)
        .set({
          status: newStatus,
          paidAt: newStatus === "paid" ? new Date() : undefined,
        })
        .where(eq(payments.gatewayPaymentId, gatewayPaymentId));

      const orderStatus =
        newStatus === "paid"
          ? "paid"
          : newStatus === "refunded"
          ? "refunded"
          : newStatus === "failed"
          ? "cancelled"
          : undefined;

      if (orderStatus) {
        await db
          .update(orders)
          .set({ status: orderStatus })
          .where(eq(orders.id, paymentRows[0].orderId));
      }

    }
  }

  return NextResponse.json({ received: true });
}
