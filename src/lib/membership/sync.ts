import { and, eq, gte, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import { getSubscriptionGateway } from "@/lib/payment/subscription-factory";
import type { SubscriptionGateway } from "@/lib/payment/subscription-types";
import { activateMemberBySubscription, suspendMemberBySubscription } from "./subscription";
import { isPastGrace, parseGatewayDate } from "./status";

export type MemberSyncResult =
  | "active"
  | "pending"
  | "suspended"
  | "cancelled"
  | "not_found"
  | "unsupported";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Normaliza o que o gateway sabe: estado completo ou, no mínimo, "pagou?". */
async function readBilling(gateway: SubscriptionGateway, subscriptionId: string) {
  if (gateway.getBillingState) return gateway.getBillingState(subscriptionId);
  const hasPaid = await gateway.hasPaidCharge!(subscriptionId);
  return { hasPaid, oldestOverdueDueDate: null, nextDueDate: null, openInvoiceUrl: null };
}

/**
 * Sincroniza o sócio de uma assinatura com o GATEWAY (fonte da verdade). INTERNO
 * — usado pelos webhooks, pela carteirinha, pelo admin e pelo cron. Nunca confia
 * no corpo do webhook.
 *
 * Regras (ver ./status): mensalidade vencida além da carência → suspenso; com
 * pagamento e sem atraso além da carência → ativo (próximo vencimento do
 * gateway); sem nenhum pagamento → segue pendente. Cancelado não é alterado.
 *
 * Corrida webhook × cadastro: o cartão é cobrado na criação da assinatura e o
 * webhook pode chegar antes de `members.subscriptionId` ser gravado. Nesse caso o
 * sócio é achado pela referência externa da assinatura (= id do sócio) e o
 * vínculo é gravado aqui, só se o sócio ainda não tiver outra assinatura.
 */
export async function syncMemberSubscription(subscriptionId: string): Promise<MemberSyncResult> {
  if (!subscriptionId) return "not_found";
  const active = await getSubscriptionGateway();
  const gateway = active?.gateway;
  if (!gateway || (!gateway.getBillingState && !gateway.hasPaidCharge)) return "unsupported";

  const db = await getDb();
  let [member] = await db
    .select({ id: members.id, status: members.status })
    .from(members)
    .where(eq(members.subscriptionId, subscriptionId))
    .limit(1);

  if (!member && gateway.getSubscriptionExternalReference) {
    const ref = await gateway.getSubscriptionExternalReference(subscriptionId);
    if (ref && UUID_RE.test(ref)) {
      [member] = await db
        .update(members)
        .set({ subscriptionId, gatewaySlug: active!.slug })
        .where(
          and(
            eq(members.id, ref),
            or(isNull(members.subscriptionId), eq(members.subscriptionId, subscriptionId))
          )
        )
        .returning({ id: members.id, status: members.status });
    }
  }

  if (!member) return "not_found";
  if (member.status === "cancelled") return "cancelled";

  const billing = await readBilling(gateway, subscriptionId);

  if (isPastGrace(billing.oldestOverdueDueDate)) {
    if (member.status === "active") await suspendMemberBySubscription(subscriptionId);
    // Pendente que nunca pagou continua pendente (não vira "suspenso").
    return member.status === "pending" ? "pending" : "suspended";
  }

  if (billing.hasPaid) {
    await activateMemberBySubscription(subscriptionId, parseGatewayDate(billing.nextDueDate));
    return "active";
  }
  return member.status === "suspended" ? "suspended" : "pending";
}

/** Mesmo que acima, a partir do id do sócio (carteirinha / admin). */
export async function syncMemberById(memberId: string): Promise<MemberSyncResult> {
  if (!UUID_RE.test(memberId)) return "not_found";
  const db = await getDb();
  const [member] = await db
    .select({ status: members.status, subscriptionId: members.subscriptionId })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);
  if (!member) return "not_found";
  if (member.status === "cancelled" || !member.subscriptionId) return member.status;
  return syncMemberSubscription(member.subscriptionId);
}

/**
 * Rede de segurança do cron diário: sincroniza (1) pendentes recentes (webhook
 * perdido) e (2) ativos/suspensos com mensalidade já vencida — é aqui que a
 * carência expira e o sócio é suspenso, ou volta a ativo se pagou. Lote limitado
 * para não estourar o tempo do cron nem a cota do gateway.
 */
export async function syncPendingMembers(
  limit = 100
): Promise<{ checked: number; activated: number; suspended: number }> {
  const db = await getDb();
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ subscriptionId: members.subscriptionId })
    .from(members)
    .where(
      and(
        isNotNull(members.subscriptionId),
        or(
          and(eq(members.status, "pending"), gte(members.createdAt, since)),
          and(inArray(members.status, ["active", "suspended"]), lt(members.nextBillingDate, now))
        )
      )
    )
    .limit(limit);

  let activated = 0;
  let suspended = 0;
  for (const r of rows) {
    try {
      const result = await syncMemberSubscription(r.subscriptionId!);
      if (result === "active") activated++;
      if (result === "suspended") suspended++;
    } catch (err) {
      console.error("[syncPendingMembers] falha ao sincronizar assinatura:", err);
    }
  }
  return { checked: rows.length, activated, suspended };
}

/**
 * Página de pagamento (fatura do gateway) da mensalidade em aberto mais antiga
 * — para o sócio pendente/suspenso regularizar pela carteirinha. URL validada
 * no cliente do gateway (só https do próprio gateway).
 */
export async function getMemberOpenInvoiceUrl(memberId: string): Promise<string | null> {
  if (!UUID_RE.test(memberId)) return null;
  const db = await getDb();
  const [member] = await db
    .select({ subscriptionId: members.subscriptionId })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);
  if (!member?.subscriptionId) return null;
  const active = await getSubscriptionGateway();
  if (!active?.gateway.getBillingState) return null;
  const billing = await active.gateway.getBillingState(member.subscriptionId);
  return billing.openInvoiceUrl;
}
