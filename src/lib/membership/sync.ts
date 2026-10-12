import { and, eq, gte, isNotNull, isNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import { getSubscriptionGateway } from "@/lib/payment/subscription-factory";
import { activateMemberBySubscription } from "./subscription";

export type MemberSyncResult = "active" | "pending" | "cancelled" | "not_found" | "unsupported";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sincroniza o sócio de uma assinatura com o GATEWAY (fonte da verdade). INTERNO
 * — usado pelos webhooks, pela carteirinha e pelo admin. Nunca confia no corpo
 * do webhook: só ativa se o gateway disser que há cobrança paga.
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
  if (!gateway?.hasPaidCharge) return "unsupported";

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
  if (member.status === "active" || member.status === "cancelled") return member.status;

  if (await gateway.hasPaidCharge(subscriptionId)) {
    await activateMemberBySubscription(subscriptionId);
    return "active";
  }
  return "pending";
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
  if (member.status !== "pending" || !member.subscriptionId) return member.status;
  return syncMemberSubscription(member.subscriptionId);
}

/**
 * Rede de segurança do cron diário: sincroniza sócios pendentes recentes com
 * assinatura (webhook perdido e sócio que nunca abriu a carteirinha). Lote
 * limitado para não estourar o tempo do cron nem a cota do gateway.
 */
export async function syncPendingMembers(limit = 50): Promise<{ checked: number; activated: number }> {
  const db = await getDb();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ subscriptionId: members.subscriptionId })
    .from(members)
    .where(
      and(eq(members.status, "pending"), isNotNull(members.subscriptionId), gte(members.createdAt, since))
    )
    .limit(limit);

  let activated = 0;
  for (const r of rows) {
    try {
      if ((await syncMemberSubscription(r.subscriptionId!)) === "active") activated++;
    } catch (err) {
      console.error("[syncPendingMembers] falha ao sincronizar assinatura:", err);
    }
  }
  return { checked: rows.length, activated };
}
