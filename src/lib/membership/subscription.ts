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
      // Pagamento confirmado: marca o histórico que o 1º mês grátis exige (anti-abuso).
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
