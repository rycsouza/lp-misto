import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import { sendMemberWelcomeEmail } from "@/lib/email";

/**
 * Ativa/cancela sócio a partir do ID da assinatura do gateway. INTERNO — chamado
 * apenas pelo webhook de assinatura (Asaas). NÃO é server action de propósito:
 * expor isto como endpoint POST público permitiria ativar um sócio SEM pagamento.
 */
export async function activateMemberBySubscription(subscriptionId: string): Promise<void> {
  const db = await getDb();
  const [updated] = await db
    .update(members)
    .set({
      status: "active",
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    .where(eq(members.subscriptionId, subscriptionId))
    .returning({ id: members.id });
  revalidatePath("/admin/socios");
  if (updated) sendMemberWelcomeEmail(updated.id).catch(console.error);
}

export async function cancelMemberBySubscription(subscriptionId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(members)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(eq(members.subscriptionId, subscriptionId));
  revalidatePath("/admin/socios");
}
