import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { cancelMemberBySubscription } from "@/lib/membership/subscription";
import { syncMemberSubscription } from "@/lib/membership/sync";
import { getActiveGatewayWebhookSecret } from "@/lib/payment";

// Asaas envia o token no header "asaas-access-token". Vale o token salvo no
// gateway do clube (Admin → Gateways → "token do webhook"); ASAAS_WEBHOOK_TOKEN
// (env) segue aceito por compatibilidade. Multi-tenant: cada clube tem a sua
// conta Asaas e o seu token — por isso o do gateway é o principal.

/** Comparação em tempo constante. */
function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Fail-closed: sem token configurado (env nem gateway), rejeita. */
async function tokenMatches(incoming: string): Promise<boolean> {
  if (!incoming) return false;
  const candidates: string[] = [];
  if (process.env.ASAAS_WEBHOOK_TOKEN) candidates.push(process.env.ASAAS_WEBHOOK_TOKEN);
  try {
    const fromGateway = await getActiveGatewayWebhookSecret();
    if (fromGateway) candidates.push(fromGateway);
  } catch {
    /* sem gateway legível → só o env */
  }
  return candidates.some((c) => safeEqual(incoming, c));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // FAIL-CLOSED: o cancelamento abaixo confia no corpo, então exige token válido.
  const incomingToken = req.headers.get("asaas-access-token") ?? "";
  if (!(await tokenMatches(incomingToken))) {
    console.warn("[webhook asaas] token inválido ou ausente — verifique o token do webhook no gateway");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.event as string | undefined;
  const payment = body.payment as { subscription?: string } | undefined;
  const subscriptionId = typeof payment?.subscription === "string" ? payment.subscription : undefined;

  if (!event || !subscriptionId) {
    return NextResponse.json({ received: true });
  }

  try {
    switch (event) {
      // Pagamento confirmado → ativa. O corpo é só GATILHO: a ativação reconsulta
      // o gateway (syncMemberSubscription) e resolve a corrida com o cadastro.
      case "PAYMENT_RECEIVED":
      case "PAYMENT_CONFIRMED": {
        const result = await syncMemberSubscription(subscriptionId);
        if (result === "not_found") {
          console.warn(`[webhook asaas] sócio da assinatura ${subscriptionId} não encontrado`);
        }
        break;
      }

      // Subscription cancelled or chargebacked → cancel member
      case "SUBSCRIPTION_CANCELLED":
      case "PAYMENT_CHARGEBACK_REQUESTED":
      case "PAYMENT_REFUNDED":
        await cancelMemberBySubscription(subscriptionId);
        break;

      default:
        // PAYMENT_OVERDUE, PAYMENT_CREATED, etc. — no action needed
        break;
    }
  } catch (err) {
    console.error("Asaas webhook processing error:", err);
    // 200 mesmo em erro: falhas seguidas PAUSAM a fila de webhooks da conta no
    // Asaas (afetaria pedidos também). A recuperação vem da sincronização ativa
    // (carteirinha, admin "Verificar pagamento" e cron diário).
  }

  return NextResponse.json({ received: true });
}
