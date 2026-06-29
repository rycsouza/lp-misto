import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  activateMemberBySubscription,
  cancelMemberBySubscription,
} from "@/app/actions/membership";

// Asaas envia o token no header "asaas-access-token".
// Configure ASAAS_WEBHOOK_TOKEN (.env.local e Vercel) com o valor da conta Asaas.
const WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN ?? "";

/** Comparação em tempo constante. Fail-closed: sem token configurado, rejeita. */
function tokenMatches(incoming: string): boolean {
  if (!WEBHOOK_TOKEN) return false;
  const a = Buffer.from(incoming);
  const b = Buffer.from(WEBHOOK_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // FAIL-CLOSED: este webhook ATIVA sócio confiando no corpo (sem reconsultar o
  // gateway), então o token é obrigatório. Sem token válido, rejeita — evita que
  // um POST forjado ative assinatura sem pagamento.
  const incomingToken = req.headers.get("asaas-access-token") ?? "";
  if (!tokenMatches(incomingToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.event as string | undefined;
  const payment = body.payment as
    | { subscription?: string; status?: string }
    | undefined;

  if (!event || !payment) {
    return NextResponse.json({ received: true });
  }

  const subscriptionId = payment.subscription;

  try {
    switch (event) {
      // Payment confirmed → activate member
      case "PAYMENT_RECEIVED":
      case "PAYMENT_CONFIRMED":
        if (subscriptionId) {
          await activateMemberBySubscription(subscriptionId);
        }
        break;

      // Subscription cancelled or chargebacked → cancel member
      case "SUBSCRIPTION_CANCELLED":
      case "PAYMENT_CHARGEBACK_REQUESTED":
      case "PAYMENT_REFUNDED":
        if (subscriptionId) {
          await cancelMemberBySubscription(subscriptionId);
        }
        break;

      default:
        // PAYMENT_OVERDUE, PAYMENT_CREATED, etc. — no action needed
        break;
    }
  } catch (err) {
    console.error("Asaas webhook processing error:", err);
    // Return 200 so Asaas doesn't retry; log the error server-side
  }

  return NextResponse.json({ received: true });
}
