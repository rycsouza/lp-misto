import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { db } from "@/lib/db/client";
import { payments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { asaasToPaymentStatus } from "@/lib/payment/asaas";
import { getPaymentGatewayBySlug } from "@/lib/payment";
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

  if (gatewayPaymentId) {
    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.gatewayPaymentId, gatewayPaymentId))
      .limit(1);

    if (paymentRows[0]) {
      // SEGURANÇA: o corpo do webhook é apenas um GATILHO. Como a verificação de
      // assinatura do Asaas pode ser contornada (header ausente / token não
      // configurado), NÃO confiamos no `status` enviado — reconsultamos o status
      // no gateway, que é a fonte da verdade. Assim um webhook forjado só provoca
      // uma reconsulta que devolve o status real (não marca pago sem pagamento).
      let newStatus: "pending" | "paid" | "failed" | "refunded";
      const slug = paymentRows[0].gatewaySlug;
      if (slug) {
        try {
          const gateway = await getPaymentGatewayBySlug(slug);
          newStatus = await gateway.getPaymentStatus(gatewayPaymentId);
        } catch (err) {
          console.error("[webhook] falha ao reconsultar status no gateway:", err);
          return NextResponse.json({ received: true }); // em dúvida, não aplica
        }
      } else if (rawStatus) {
        // Pagamento legado sem slug registrado — cai para o status do corpo.
        newStatus = asaasToPaymentStatus(rawStatus);
      } else {
        return NextResponse.json({ received: true });
      }

      // Aplicação idempotente e direcional: nunca rebaixa um `paid` para
      // `failed`, e dispara os efeitos colaterais apenas na transição real.
      await applyGatewayStatus(paymentRows[0].id, paymentRows[0].orderId, newStatus);
    } else {
      console.warn(
        `[webhook] Pagamento ${gatewayPaymentId} (${rawStatus ?? "?"}) não encontrado no banco`
      );
    }
  }

  return NextResponse.json({ received: true });
}
