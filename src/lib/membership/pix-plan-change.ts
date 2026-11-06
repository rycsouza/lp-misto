/**
 * Troca de plano do sócio no Pix Automático. INTERNO — chamado pela área logada (sócio dono
 * da conta, já autenticado e com limite de tentativas).
 *
 * No Pix Automático toda autorização nova precisa do consentimento do pagador no app do banco,
 * dado junto com um pagamento imediato (QR). Por isso a troca é:
 * 1. cria uma NOVA autorização no plano escolhido, com o QR de uma mensalidade do novo plano;
 * 2. grava como "em andamento" (pixAutomaticPendingAuthorizationId / PendingPlanId);
 * 3. quando o banco confirma (ACTIVE), syncMemberPixAutomatic cancela no Asaas a autorização e
 *    a assinatura antigas e troca o plano (ver applyPlanChange em ./pix-automatic).
 *
 * Sem cobrança dupla nem dias perdidos: o QR paga o mês SEGUINTE ao período já pago, e os
 * débitos automáticos do novo plano começam um mês depois do vencimento atual.
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members, membershipPlans } from "@/lib/db/schema";
import { getSubscriptionGateway } from "@/lib/payment/subscription-factory";
import type { SubscriptionPayerDocument } from "@/lib/payment/subscription-types";
import { todayBrasilia } from "@/lib/date";
import { addOneMonthBrasilia } from "./billing-date";
import {
  PIX_AUTOMATIC_ENABLED_KEY,
  PIX_AUTOMATIC_QR_SECONDS,
  cancelPixAutomaticAuthorization,
  pixAutomaticAvailable,
  pixAutomaticContractId,
  syncMemberPixAutomatic,
} from "./pix-automatic";

export type PixPlanChangeError =
  | "not_found"
  | "not_active"
  | "not_pix_automatic"
  | "same_plan"
  | "plan_unavailable"
  | "audience_mismatch"
  | "unavailable"
  | "gateway_error";

export type PixPlanChangeStart =
  | {
      ok: true;
      planName: string;
      /** 1º débito automático do novo plano (AAAA-MM-DD). */
      startsOn: string;
      pix: { payload: string; imageBase64: string | null; expiresAt: string | null };
    }
  | { ok: false; error: PixPlanChangeError };

/** Date → AAAA-MM-DD no fuso de Brasília. */
function toDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Início dos débitos do novo plano: um mês depois do vencimento atual (o QR paga o mês entre
 * os dois). Vencimento ausente ou já passado: um mês depois de hoje.
 */
export function pixPlanChangeStartDate(nextBillingDate: Date | null, today: string): string {
  const base = nextBillingDate ? toDay(nextBillingDate) : today;
  return addOneMonthBrasilia(base > today ? base : today);
}

export async function startPixAutomaticPlanChange(params: {
  memberId: string;
  newPlanId: string;
}): Promise<PixPlanChangeStart> {
  const db = await getDb();
  const [m] = await db
    .select({
      id: members.id,
      name: members.name,
      email: members.email,
      whatsapp: members.whatsapp,
      cpf: members.cpf,
      cnpj: members.cnpj,
      companyName: members.companyName,
      status: members.status,
      planId: members.planId,
      paymentMethod: members.paymentMethod,
      gatewaySlug: members.gatewaySlug,
      nextBillingDate: members.nextBillingDate,
      pendingAuthorizationId: members.pixAutomaticPendingAuthorizationId,
    })
    .from(members)
    .where(eq(members.id, params.memberId))
    .limit(1);
  if (!m) return { ok: false, error: "not_found" };
  if (m.status !== "active") return { ok: false, error: "not_active" };
  if (m.paymentMethod !== "pix_automatic") return { ok: false, error: "not_pix_automatic" };
  if (m.planId === params.newPlanId) return { ok: false, error: "same_plan" };

  const [plan] = await db
    .select({
      id: membershipPlans.id,
      name: membershipPlans.name,
      priceCents: membershipPlans.priceCents,
      active: membershipPlans.active,
      audience: membershipPlans.audience,
    })
    .from(membershipPlans)
    .where(eq(membershipPlans.id, params.newPlanId))
    .limit(1);
  if (!plan || !plan.active) return { ok: false, error: "plan_unavailable" };
  // CPF não vira CNPJ (e vice-versa) na troca: o documento do pagador muda.
  if (plan.audience !== (m.cnpj ? "pj" : "pf")) return { ok: false, error: "audience_mismatch" };

  const active = await getSubscriptionGateway();
  const { getSiteConfig } = await import("@/lib/config");
  const config = await getSiteConfig().catch(() => null);
  if (
    !active ||
    active.slug !== m.gatewaySlug ||
    !pixAutomaticAvailable(active.slug, config?.[PIX_AUTOMATIC_ENABLED_KEY]) ||
    !active.gateway.createPixAutomaticAuthorization
  ) {
    return { ok: false, error: "unavailable" };
  }

  const payer: SubscriptionPayerDocument | null = m.cnpj
    ? m.companyName
      ? { cnpj: m.cnpj, companyName: m.companyName }
      : null
    : m.cpf
      ? { cpf: m.cpf }
      : null;
  if (!payer || !m.whatsapp) return { ok: false, error: "unavailable" };

  // Troca anterior ainda aguardando: encerra para não ficarem dois QRs válidos.
  if (m.pendingAuthorizationId) {
    try {
      await cancelPixAutomaticAuthorization(active.gateway, m.pendingAuthorizationId);
    } catch (err) {
      console.error("[troca-pix] falha ao encerrar a troca anterior:", err instanceof Error ? err.name : "erro");
    }
  }

  const startsOn = pixPlanChangeStartDate(m.nextBillingDate, todayBrasilia());
  try {
    const result = await active.gateway.createPixAutomaticAuthorization({
      programName: config?.membershipProgramName,
      memberName: m.name,
      memberEmail: m.email,
      memberPhone: m.whatsapp,
      ...payer,
      externalRef: m.id,
      planName: plan.name,
      amountCents: plan.priceCents,
      contractId: pixAutomaticContractId(m.id),
      startDate: startsOn,
      expirationSeconds: PIX_AUTOMATIC_QR_SECONDS,
    });
    await db
      .update(members)
      .set({ pixAutomaticPendingAuthorizationId: result.authorizationId, pixAutomaticPendingPlanId: plan.id })
      .where(eq(members.id, m.id));
    return {
      ok: true,
      planName: plan.name,
      startsOn,
      pix: { payload: result.qrPayload, imageBase64: result.qrImageBase64, expiresAt: result.expiresAt },
    };
  } catch (err) {
    console.error("[troca-pix] falha ao criar a nova autorização:", err instanceof Error ? err.name : "erro");
    return { ok: false, error: "gateway_error" };
  }
}

export type PixPlanChangeStatus = "pending" | "done" | "failed";

/**
 * Situação da troca para a tela (reconsulta o gateway; quem chama limita a frequência):
 * "done" = o plano já é o pedido; "pending" = aguardando o pagador; "failed" = não concluiu.
 */
export async function pixPlanChangeStatus(memberId: string, requestedPlanId: string): Promise<PixPlanChangeStatus> {
  const db = await getDb();
  const read = async () =>
    (
      await db
        .select({ planId: members.planId, pendingAuthorizationId: members.pixAutomaticPendingAuthorizationId })
        .from(members)
        .where(eq(members.id, memberId))
        .limit(1)
    )[0];
  let m = await read();
  if (!m) return "failed";
  if (m.pendingAuthorizationId) {
    await syncMemberPixAutomatic(m.pendingAuthorizationId);
    m = (await read()) ?? m;
  }
  if (m.planId === requestedPlanId && !m.pendingAuthorizationId) return "done";
  return m.pendingAuthorizationId ? "pending" : "failed";
}
