import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { members, membershipPlans } from "@/lib/db/schema";
import { getSubscriptionGateway } from "@/lib/payment/subscription-factory";
import type { AsaasCardData } from "@/lib/payment/subscription-types";
import { todayBrasilia } from "@/lib/date";

export type PlanChangeResult =
  | { ok: true; startsOn: string; planName: string }
  | {
      ok: false;
      error:
        | "not_found"
        | "not_active"
        | "same_plan"
        | "plan_unavailable"
        | "unsupported_gateway"
        | "card_required"
        | "gateway_error";
    };

/** Date → AAAA-MM-DD no fuso de Brasília. */
function toDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Troca de plano SEM depender do gateway alterar valor de assinatura (no Asaas,
 * mudar valor de assinatura de cartão exige liberação do gerente): cria uma
 * NOVA assinatura no plano escolhido com a 1ª cobrança no PRÓXIMO VENCIMENTO
 * do plano atual e cancela a atual. Sem cobrança dupla nem reembolso.
 *
 * Até o vencimento o sócio segue no plano atual (já pago); o novo plano vira
 * `planId` quando a 1ª mensalidade da nova assinatura é paga (pendingPlanId,
 * aplicado na ativação). Ordem segura: cria a nova → vincula → cancela a
 * antiga; se cancelar a antiga falhar, desfaz tudo (nunca duas cobranças ativas).
 * INTERNO — chamado pela área logada (sócio dono da conta).
 */
export async function changeMemberPlan(params: {
  memberId: string;
  newPlanId: string;
  method: "card" | "pix";
  asaasCardData?: AsaasCardData;
  remoteIp?: string;
}): Promise<PlanChangeResult> {
  const db = await getDb();
  const [m] = await db
    .select({
      id: members.id,
      name: members.name,
      email: members.email,
      whatsapp: members.whatsapp,
      cpf: members.cpf,
      status: members.status,
      planId: members.planId,
      pendingPlanId: members.pendingPlanId,
      subscriptionId: members.subscriptionId,
      gatewaySlug: members.gatewaySlug,
      nextBillingDate: members.nextBillingDate,
    })
    .from(members)
    .where(eq(members.id, params.memberId))
    .limit(1);
  if (!m) return { ok: false, error: "not_found" };
  // Suspenso/pendente: primeiro regulariza (pagar em aberto); cancelado: nova adesão.
  if (m.status !== "active" || !m.subscriptionId) return { ok: false, error: "not_active" };
  if (params.newPlanId === (m.pendingPlanId ?? m.planId)) return { ok: false, error: "same_plan" };

  const [plan] = await db
    .select({ id: membershipPlans.id, name: membershipPlans.name, priceCents: membershipPlans.priceCents, active: membershipPlans.active })
    .from(membershipPlans)
    .where(eq(membershipPlans.id, params.newPlanId))
    .limit(1);
  if (!plan || !plan.active) return { ok: false, error: "plan_unavailable" };

  const active = await getSubscriptionGateway();
  if (!active || active.slug !== m.gatewaySlug || !active.slug.startsWith("asaas")) {
    return { ok: false, error: "unsupported_gateway" };
  }
  if (params.method === "card" && !params.asaasCardData) return { ok: false, error: "card_required" };

  const today = todayBrasilia();
  const due = m.nextBillingDate ? toDay(m.nextBillingDate) : today;
  const firstDueDate = due > today ? due : today;

  // 1) nova assinatura (cobra só no próximo vencimento)
  let created: { subscriptionId: string; gatewayCustomerId?: string };
  try {
    created = await active.gateway.createSubscription({
      memberName: m.name,
      memberEmail: m.email,
      memberPhone: m.whatsapp ?? "",
      cpf: m.cpf ?? "",
      externalRef: m.id,
      planName: plan.name,
      amountCents: plan.priceCents,
      asaasCardData: params.method === "card" ? params.asaasCardData : undefined,
      remoteIp: params.remoteIp,
      firstDueDate,
    });
  } catch (err) {
    console.error("[changeMemberPlan] falha ao criar nova assinatura:", err);
    return { ok: false, error: "gateway_error" };
  }

  // 2) vincula a nova ANTES de cancelar a atual: o webhook "assinatura removida"
  //    da atual não acha mais o sócio por ela (não o cancela por engano).
  //    O plano novo fica agendado até a 1ª mensalidade paga.
  await db
    .update(members)
    .set({
      subscriptionId: created.subscriptionId,
      ...(created.gatewayCustomerId ? { gatewayCustomerId: created.gatewayCustomerId } : {}),
      pendingPlanId: plan.id,
    })
    .where(eq(members.id, m.id));

  // 3) cancela a atual; se falhar, volta o vínculo e desfaz a nova (nunca duas
  //    cobranças ativas)
  try {
    await active.gateway.cancelSubscription(m.subscriptionId);
  } catch (err) {
    console.error("[changeMemberPlan] falha ao cancelar assinatura atual — desfazendo:", err);
    await db
      .update(members)
      .set({ subscriptionId: m.subscriptionId, pendingPlanId: m.pendingPlanId })
      .where(eq(members.id, m.id));
    await active.gateway.cancelSubscription(created.subscriptionId).catch((e) =>
      console.error("[changeMemberPlan] ATENÇÃO: falha ao desfazer nova assinatura", created.subscriptionId, e)
    );
    return { ok: false, error: "gateway_error" };
  }
  revalidatePath("/admin/socios");
  return { ok: true, startsOn: firstDueDate, planName: plan.name };
}
