import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { db } from "@/lib/db/client";
import { payments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { asaasToPaymentStatus } from "@/lib/payment/asaas";
import { applyGatewayStatus } from "@/lib/payment/sync";

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

  if (gatewayPaymentId && rawStatus) {
    const newStatus = asaasToPaymentStatus(rawStatus);

    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.gatewayPaymentId, gatewayPaymentId))
      .limit(1);

    if (paymentRows[0]) {
      // Aplicação idempotente e direcional: nunca rebaixa um `paid` para
      // `failed`, e dispara os efeitos colaterais apenas na transição real.
      await applyGatewayStatus(paymentRows[0].id, paymentRows[0].orderId, newStatus);
    } else {
      console.warn(
        `[webhook] Pagamento ${gatewayPaymentId} (${rawStatus}) não encontrado no banco`
      );
    }
  }

  return NextResponse.json({ received: true });
}
