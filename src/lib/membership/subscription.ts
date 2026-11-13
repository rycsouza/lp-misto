import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import { sendMemberWelcomeEmail } from "@/lib/email";

/**
 * Ativa/suspende/cancela sócio a partir do ID da assinatura do gateway. INTERNO —
 * chamado pela sincronização com o gateway e pelo webhook. NÃO é server action de
 * propósito: expor isto como endpoint POST público permitiria ativar um sócio SEM
 * pagamento.
 */
export async function activateMemberBySubscription(
  subscriptionId: string,
  nextBillingDate?: Date | null
): Promise<void> {
  const db = await getDb();
  // Status ANTES do update: o boas-vindas sai só na 1ª ativação (pendente →
  // ativo), não em cada mensalidade, reentrega de webhook ou volta de suspensão.
  const [before] = await db
    .select({ status: members.status })
    .from(members)
    .where(eq(members.subscriptionId, subscriptionId))
    .limit(1);

  const [updated] = await db
    .update(members)
    .set({
      status: "active",
      // Pagamento confirmado: marca que o sócio já teve mensalidade paga.
      hasPaid: true,
      nextBillingDate: nextBillingDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    .where(and(eq(members.subscriptionId, subscriptionId), ne(members.status, "cancelled")))
    .returning({ id: members.id });

  // Troca de plano agendada: a 1ª mensalidade paga da nova assinatura efetiva o
  // plano novo. Isolado em try/catch: sem a migração 0030 (coluna
  // pending_plan_id) a ATIVAÇÃO acima segue funcionando.
  try {
    await db
      .update(members)
      .set({ planId: sql`${members.pendingPlanId}`, pendingPlanId: null })
      .where(and(eq(members.subscriptionId, subscriptionId), isNotNull(members.pendingPlanId)));
  } catch (err) {
    console.error("[activateMemberBySubscription] falha ao aplicar plano agendado:", err);
  }
  revalidatePath("/admin/socios");

  if (updated && before?.status === "pending") {
    sendMemberWelcomeEmail(updated.id).catch(console.error);
  }
}

/** Mensalidade vencida além da carência: QR e desconto suspensos até pagar. */
export async function suspendMemberBySubscription(subscriptionId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(members)
    .set({ status: "suspended" })
    .where(and(eq(members.subscriptionId, subscriptionId), eq(members.status, "active")));
  revalidatePath("/admin/socios");
}

/**
 * Cancela o sócio. Por padrão mantém os benefícios até o fim do período já pago
 * (nextBillingDate). `immediate` (estorno/chargeback) encerra na hora.
 */
export async function cancelMemberBySubscription(
  subscriptionId: string,
  opts: { immediate?: boolean } = {}
): Promise<void> {
  const db = await getDb();
  const now = new Date();
  await db
    .update(members)
    .set({
      status: "cancelled",
      cancelledAt: now,
      ...(opts.immediate ? { nextBillingDate: now } : {}),
    })
    // Cancelamento comum é idempotente (não reescreve a data de quem já cancelou);
    // estorno/chargeback sempre encerra os benefícios na hora.
    .where(
      opts.immediate
        ? eq(members.subscriptionId, subscriptionId)
        : and(eq(members.subscriptionId, subscriptionId), ne(members.status, "cancelled"))
    );
  revalidatePath("/admin/socios");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Estorno ou chargeback de QUALQUER cobrança paga por um sócio encerra os benefícios na hora,
 * não só a da assinatura atual (auditoria run-2: depois de uma troca de plano a cobrança
 * contestada é da assinatura anterior; a 1ª mensalidade do Pix Automático é avulsa).
 * O sócio é achado por, nesta ordem:
 *  1. assinatura atual (members.subscriptionId);
 *  2. ledger das mensalidades (membership_payments.gateway_payment_id → member_id);
 *  3. referência externa da assinatura relida NO GATEWAY (= id do sócio);
 *  4. cobrança avulsa: cliente do gateway (members.gatewayCustomerId).
 * INTERNO — chamado só pelo webhook autenticado do Asaas. Devolve quantos sócios encerrou.
 */
export async function cancelMemberForReversedPayment(ref: {
  subscriptionId?: string;
  paymentId?: string;
  customerId?: string;
}): Promise<number> {
  const db = await getDb();
  const ids = new Set<string>();

  if (ref.subscriptionId) {
    const rows = await db.select({ id: members.id }).from(members).where(eq(members.subscriptionId, ref.subscriptionId));
    for (const r of rows) ids.add(r.id);
  }
  if (ids.size === 0 && ref.paymentId) {
    const { membershipPayments } = await import("@/lib/db/schema");
    const rows = await db
      .select({ memberId: membershipPayments.memberId })
      .from(membershipPayments)
      .where(eq(membershipPayments.gatewayPaymentId, ref.paymentId))
      .limit(1);
    for (const r of rows) if (r.memberId) ids.add(r.memberId);
  }
  if (ids.size === 0 && ref.subscriptionId) {
    const { getSubscriptionGateway } = await import("@/lib/payment/subscription-factory");
    const active = await getSubscriptionGateway().catch(() => null);
    const externalRef = await active?.gateway.getSubscriptionExternalReference?.(ref.subscriptionId).catch(() => null);
    if (externalRef && UUID_RE.test(externalRef)) ids.add(externalRef);
  }
  if (ids.size === 0 && !ref.subscriptionId && ref.customerId) {
    const rows = await db.select({ id: members.id }).from(members).where(eq(members.gatewayCustomerId, ref.customerId));
    for (const r of rows) ids.add(r.id);
  }

  const now = new Date();
  for (const id of ids) {
    await db.update(members).set({ status: "cancelled", cancelledAt: now, nextBillingDate: now }).where(eq(members.id, id));
  }
  if (ids.size > 0) revalidatePath("/admin/socios");
  return ids.size;
}
