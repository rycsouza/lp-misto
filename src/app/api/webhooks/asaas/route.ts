import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { cancelMemberBySubscription } from "@/lib/membership/subscription";
import { syncMemberSubscription } from "@/lib/membership/sync";
import { recordSubscriptionPayments } from "@/lib/membership/payments-ledger";
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
  const subscription = body.subscription as { id?: string } | undefined;
  // Eventos de cobrança trazem payment.subscription; eventos de assinatura, subscription.id.
  const rawSub = payment?.subscription ?? subscription?.id;
  const subscriptionId = typeof rawSub === "string" && rawSub ? rawSub : undefined;

  if (!event || !subscriptionId) {
    return NextResponse.json({ received: true });
  }

  try {
    switch (event) {
      // Pagamento confirmado ou vencido → reconsulta o gateway (o corpo é só
      // GATILHO): ativa, mantém ou suspende conforme a carência.
      case "PAYMENT_RECEIVED":
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_OVERDUE": {
        const result = await syncMemberSubscription(subscriptionId);
        if (result === "not_found") {
          console.warn(`[webhook asaas] sócio da assinatura ${subscriptionId} não encontrado`);
        }
        break;
      }

      // Estorno/chargeback → encerra os benefícios na hora.
      case "PAYMENT_CHARGEBACK_REQUESTED":
      case "PAYMENT_REFUNDED":
        await cancelMemberBySubscription(subscriptionId, { immediate: true });
        break;

      // Assinatura encerrada no gateway → cancela, mantendo o período já pago.
      case "SUBSCRIPTION_CANCELLED":
      case "SUBSCRIPTION_DELETED":
      case "SUBSCRIPTION_INACTIVATED":
        await cancelMemberBySubscription(subscriptionId);
        break;

      default:
        // PAYMENT_CREATED, etc. — nada a fazer
        break;
    }
  } catch (err) {
    console.error("Asaas webhook processing error:", err);
    // 200 mesmo em erro: falhas seguidas PAUSAM a fila de webhooks da conta no
    // Asaas (afetaria pedidos também). A recuperação vem da sincronização ativa
    // (carteirinha, admin "Verificar pagamento" e cron diário).
  }

  // Ledger das mensalidades (relatórios): reconsulta o gateway depois do sync, com
  // o id da assinatura como único dado do corpo. Isolado: falha só gera log.
  if (event.startsWith("PAYMENT_")) {
    try {
      await recordSubscriptionPayments(subscriptionId);
    } catch (err) {
      console.error("[webhook asaas] falha ao registrar mensalidade no ledger:", err);
    }
  }

  return NextResponse.json({ received: true });
}
