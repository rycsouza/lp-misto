import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import { getSubscriptionGateway } from "@/lib/payment/subscription-factory";

export type CancelMembershipResult =
  | { ok: true; benefitsUntil: Date | null }
  | { ok: false; error: "not_found" | "already_cancelled" | "gateway_error" };

/**
 * Cancela a assinatura do sócio: PRIMEIRO no gateway (para de cobrar), depois no
 * banco. Se o gateway falhar, nada muda aqui — o sócio não pode achar que
 * cancelou e continuar sendo cobrado. Benefícios seguem até o fim do período já
 * pago (nextBillingDate). INTERNO: chamado pela confirmação por e-mail e pelo admin.
 */
export async function cancelMembership(memberId: string): Promise<CancelMembershipResult> {
  const db = await getDb();
  const [member] = await db
    .select({
      status: members.status,
      subscriptionId: members.subscriptionId,
      gatewaySlug: members.gatewaySlug,
      nextBillingDate: members.nextBillingDate,
    })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);
  if (!member) return { ok: false, error: "not_found" };
  if (member.status === "cancelled") return { ok: false, error: "already_cancelled" };

  if (member.subscriptionId) {
    try {
      const active = await getSubscriptionGateway();
      if (!active || active.slug !== member.gatewaySlug) return { ok: false, error: "gateway_error" };
      await active.gateway.cancelSubscription(member.subscriptionId);
    } catch (err) {
      console.error("[cancelMembership] falha ao cancelar no gateway:", err);
      return { ok: false, error: "gateway_error" };
    }
  }

  // Pendente nunca pagou: nada a manter. Suspenso: o período pago já acabou.
  const keepUntil = member.status === "active" ? member.nextBillingDate : new Date();
  await db
    .update(members)
    .set({ status: "cancelled", cancelledAt: new Date(), nextBillingDate: keepUntil })
    .where(eq(members.id, memberId));
  revalidatePath("/admin/socios");
  return { ok: true, benefitsUntil: member.status === "active" ? keepUntil : null };
}
