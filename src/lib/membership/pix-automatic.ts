/**
 * Pix Automático na assinatura do sócio (Asaas, Jornada 3).
 *
 * Fluxo: a adesão cria uma AUTORIZAÇÃO no gateway com o QR Code da 1ª mensalidade. Ao pagar,
 * o sócio autoriza no app do banco as próximas cobranças. Quando o banco confirma, a
 * autorização fica ACTIVE e o Asaas cria a ASSINATURA que gera as próximas mensalidades. Daí
 * em diante o sócio segue o fluxo normal por `subscriptionId` (sync, carência, ledger).
 *
 * Troca de plano: o sócio paga um QR do novo plano e autoriza no banco uma NOVA autorização
 * (fica em `pixAutomaticPendingAuthorizationId`). Só quando ela fica ACTIVE a autorização e a
 * assinatura antigas são canceladas no Asaas e o plano muda. Até lá, nada antigo é mexido.
 *
 * INTERNO (sem "use server"): chamado pelo webhook, pela tela de adesão (status), pelo cron e
 * pelo cancelamento. Nunca confia no corpo do webhook: relê a autorização no gateway.
 */
import { and, eq, isNotNull, isNull, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import { getSubscriptionGateway } from "@/lib/payment/subscription-factory";
import type { SubscriptionGateway } from "@/lib/payment/subscription-types";
import { parseGatewayDate } from "./status";
import { addOneMonthBrasilia } from "./billing-date";
import type { MemberSyncResult } from "./sync";
import { isValidPixAutomaticAuthorizationId } from "./pix-automatic-config";

export {
  PIX_AUTOMATIC_ENABLED_KEY,
  PIX_AUTOMATIC_QR_SECONDS,
  isPixAutomaticEnabledValue,
  isValidPixAutomaticAuthorizationId,
  isValidPixAutomaticConfigValue,
  pixAutomaticAvailable,
} from "./pix-automatic-config";

/**
 * Identificador do contrato (máx. 35 caracteres, aparece no app do banco): "SOCIO-" + parte do
 * id do sócio + carimbo de tempo, para cada nova tentativa de adesão ter um contrato próprio.
 */
export function pixAutomaticContractId(memberId: string, now: Date = new Date()): string {
  const hex = memberId.replace(/[^0-9a-f]/gi, "").slice(0, 20).toUpperCase();
  return `SOCIO-${hex}-${now.getTime().toString(36).toUpperCase()}`.slice(0, 35);
}

/** Início das cobranças recorrentes: um mês depois de hoje (a 1ª mensalidade é a do QR). */
export function pixAutomaticStartDate(today: string): string {
  return addOneMonthBrasilia(today);
}

type ActiveGateway = { gateway: SubscriptionGateway; slug: string };

async function loadPixGateway(): Promise<ActiveGateway | null> {
  const active = await getSubscriptionGateway();
  if (!active?.gateway.getPixAutomaticAuthorization) return null;
  return active;
}

/**
 * Sincroniza o sócio de uma autorização com o gateway (fonte da verdade):
 * - ACTIVE: ativa o sócio (1ª mensalidade paga), grava a assinatura criada pelo gateway e o
 *   próximo vencimento; registra a 1ª mensalidade no ledger. Boas-vindas só na 1ª ativação.
 * - CANCELLED/EXPIRED com sócio ativo/suspenso: o pagador cancelou no banco (ou acabou a
 *   vigência). Encerra a assinatura no gateway e cancela o sócio mantendo o período pago.
 * - REFUSED com a 1ª mensalidade paga: o banco não confirmou a recorrência. O mês pago vale:
 *   sócio cancelado com benefício até o fim desse mês (sem cobranças futuras).
 * - Demais casos (QR não pago, expirado, recusado sem pagamento): segue pendente.
 */
export async function syncMemberPixAutomatic(authorizationId: string): Promise<MemberSyncResult> {
  if (!isValidPixAutomaticAuthorizationId(authorizationId)) return "not_found";
  const active = await loadPixGateway();
  if (!active) return "unsupported";
  const { gateway, slug } = active;

  const db = await getDb();
  const [member] = await db
    .select({
      id: members.id,
      status: members.status,
      planId: members.planId,
      subscriptionId: members.subscriptionId,
      gatewaySlug: members.gatewaySlug,
      gatewayCustomerId: members.gatewayCustomerId,
      nextBillingDate: members.nextBillingDate,
      currentAuthorizationId: members.pixAutomaticAuthorizationId,
      pendingAuthorizationId: members.pixAutomaticPendingAuthorizationId,
      pendingPlanId: members.pixAutomaticPendingPlanId,
    })
    .from(members)
    .where(
      or(
        eq(members.pixAutomaticAuthorizationId, authorizationId),
        eq(members.pixAutomaticPendingAuthorizationId, authorizationId)
      )
    )
    .limit(1);
  if (!member) return "not_found";
  // Gateway trocado depois da adesão: a autorização é de outra conta, não consulta.
  if (member.gatewaySlug && member.gatewaySlug !== slug) return "unsupported";

  const auth = await gateway.getPixAutomaticAuthorization!(authorizationId);

  // Autorização da troca de plano (ainda não é a atual): fluxo próprio.
  if (member.pendingAuthorizationId === authorizationId && member.currentAuthorizationId !== authorizationId) {
    return applyPlanChange(gateway, slug, member, auth);
  }

  if (auth.status === "ACTIVE") {
    if (member.status === "cancelled") return "cancelled";
    const firstActivation = member.status === "pending";
    const nextBillingDate = parseGatewayDate(auth.startDate) ?? member.nextBillingDate;
    await db
      .update(members)
      .set({
        ...(firstActivation ? { status: "active" as const, nextBillingDate } : {}),
        hasPaid: true,
        // A assinatura nasce no gateway depois da ativação: grava assim que aparecer.
        ...(auth.subscriptionId && !member.subscriptionId ? { subscriptionId: auth.subscriptionId } : {}),
      })
      .where(and(eq(members.id, member.id), ne(members.status, "cancelled")));
    revalidatePath("/admin/socios");

    if (firstActivation) {
      await recordFirstPayment(gateway, slug, member);
      const { sendMemberWelcomeEmail } = await import("@/lib/email");
      sendMemberWelcomeEmail(member.id).catch(console.error);
      return "active";
    }
    // Já ativo: as mensalidades seguintes seguem o fluxo da assinatura (carência, etc.).
    const subscriptionId = member.subscriptionId ?? auth.subscriptionId;
    if (subscriptionId) {
      const { syncMemberSubscription } = await import("./sync");
      return syncMemberSubscription(subscriptionId);
    }
    return member.status === "suspended" ? "suspended" : "active";
  }

  if (auth.status === "CANCELLED" || auth.status === "EXPIRED") {
    // Troca de plano em andamento: o cancelamento da autorização antiga pode ser o nosso (ao
    // ativar a nova). Decide pela NOVA: ativa → conclui a troca; aguardando → não cancela agora.
    if (member.pendingAuthorizationId && member.pendingAuthorizationId !== authorizationId) {
      const pending = await gateway.getPixAutomaticAuthorization!(member.pendingAuthorizationId);
      if (pending.status === "ACTIVE") return applyPlanChange(gateway, slug, member, pending);
      if (pending.status === "CREATED") return member.status;
    }
    if (member.status === "active" || member.status === "suspended") {
      await endRecurrence(gateway, member.subscriptionId);
      // Ativo: mantém o período já pago. Suspenso: o período pago já acabou.
      const keepUntil = member.status === "active" ? member.nextBillingDate : new Date();
      await db
        .update(members)
        .set({ status: "cancelled", cancelledAt: new Date(), nextBillingDate: keepUntil })
        .where(and(eq(members.id, member.id), ne(members.status, "cancelled")));
      revalidatePath("/admin/socios");
      return "cancelled";
    }
    return member.status;
  }

  if (auth.status === "REFUSED" && member.status === "pending" && member.gatewayCustomerId) {
    const paid = await recordFirstPayment(gateway, slug, member);
    if (paid) {
      // Recorrência recusada pelo banco, mas o 1º mês foi pago: benefício até o fim dele.
      const paidUntil = parseGatewayDate(auth.startDate) ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db
        .update(members)
        .set({ status: "cancelled", cancelledAt: new Date(), nextBillingDate: paidUntil, hasPaid: true })
        .where(and(eq(members.id, member.id), eq(members.status, "pending")));
      revalidatePath("/admin/socios");
      return "cancelled";
    }
  }

  return member.status;
}

type PlanChangeMember = {
  id: string;
  status: "pending" | "active" | "suspended" | "cancelled";
  planId: string | null;
  subscriptionId: string | null;
  currentAuthorizationId: string | null;
  pendingAuthorizationId: string | null;
  pendingPlanId: string | null;
};

/**
 * Troca de plano no Pix Automático, pela situação da NOVA autorização:
 * - ACTIVE: cancela no Asaas a autorização e a assinatura antigas (se falhar, não troca: o
 *   webhook/cron tentam de novo e o sócio nunca fica com dois débitos). Depois troca o plano,
 *   a autorização atual, a assinatura e o vencimento (o QR pagou o mês seguinte ao já pago).
 * - CANCELLED/EXPIRED/REFUSED: desiste da troca (o plano e o débito atuais seguem). Se o QR
 *   chegou a ser pago, registra no ledger e avisa no log (estorno manual pelo clube).
 * - CREATED: aguardando o pagador.
 */
async function applyPlanChange(
  gateway: SubscriptionGateway,
  slug: string,
  member: PlanChangeMember,
  auth: Awaited<ReturnType<NonNullable<SubscriptionGateway["getPixAutomaticAuthorization"]>>>
): Promise<MemberSyncResult> {
  const db = await getDb();
  const clearPending = { pixAutomaticPendingAuthorizationId: null, pixAutomaticPendingPlanId: null };

  if (auth.status === "ACTIVE") {
    if (member.status === "cancelled" || !member.pendingPlanId) {
      // Sem como aplicar (cancelado ou plano apagado): encerra a nova para não cobrar.
      await cancelPixAutomaticAuthorization(gateway, auth.id).catch((err) =>
        console.error("[pix-automatico] falha ao encerrar autorização sem uso:", err instanceof Error ? err.name : "erro")
      );
      await db.update(members).set(clearPending).where(eq(members.id, member.id));
      return member.status;
    }
    try {
      if (member.currentAuthorizationId) await cancelPixAutomaticAuthorization(gateway, member.currentAuthorizationId);
      if (member.subscriptionId) await gateway.cancelSubscription(member.subscriptionId);
    } catch (err) {
      console.error("[pix-automatico] troca de plano: falha ao cancelar o débito antigo, tenta de novo depois:", err instanceof Error ? err.name : "erro");
      return member.status;
    }
    const nextBillingDate = parseGatewayDate(auth.startDate);
    await db
      .update(members)
      .set({
        // Ativo de novo, caso um aviso de cancelamento da autorização antiga tenha chegado antes.
        status: "active",
        cancelledAt: null,
        planId: member.pendingPlanId,
        pixAutomaticAuthorizationId: auth.id,
        subscriptionId: auth.subscriptionId,
        gatewayCustomerId: auth.customerId ?? undefined,
        ...(nextBillingDate ? { nextBillingDate } : {}),
        hasPaid: true,
        ...clearPending,
      })
      .where(and(eq(members.id, member.id), eq(members.pixAutomaticPendingAuthorizationId, auth.id)));
    if (auth.customerId) {
      await recordFirstPayment(gateway, slug, {
        id: member.id,
        planId: member.pendingPlanId,
        gatewayCustomerId: auth.customerId,
      });
    }
    revalidatePath("/admin/socios");
    return member.status;
  }

  if (auth.status === "CANCELLED" || auth.status === "EXPIRED" || auth.status === "REFUSED") {
    const paid =
      auth.customerId &&
      (await recordFirstPayment(gateway, slug, {
        id: member.id,
        planId: member.pendingPlanId,
        gatewayCustomerId: auth.customerId,
      }));
    if (paid) {
      console.warn("[pix-automatico] troca de plano não autorizada pelo banco com o QR pago: estorno manual pelo clube");
    }
    await db
      .update(members)
      .set(clearPending)
      .where(and(eq(members.id, member.id), eq(members.pixAutomaticPendingAuthorizationId, auth.id)));
    return member.status;
  }

  return member.status;
}

/** Registra a 1ª mensalidade (QR imediato) no ledger. Devolve se ela está paga. Falha: só log. */
async function recordFirstPayment(
  gateway: SubscriptionGateway,
  slug: string,
  member: { id: string; planId: string | null; gatewayCustomerId: string | null }
): Promise<boolean> {
  if (!member.gatewayCustomerId || !gateway.findPixAutomaticFirstPayment) return false;
  try {
    const payment = await gateway.findPixAutomaticFirstPayment(member.gatewayCustomerId);
    if (!payment) return false;
    const { recordStandalonePayment } = await import("./payments-ledger");
    await recordStandalonePayment({ id: member.id, planId: member.planId }, slug, payment);
    return true;
  } catch (err) {
    console.error("[pix-automatico] falha ao registrar a 1ª mensalidade:", err instanceof Error ? err.name : "erro");
    return false;
  }
}

/** Encerra a assinatura do gateway (se já existir) para não sobrar cobrança. Falha: só log. */
async function endRecurrence(gateway: SubscriptionGateway, subscriptionId: string | null): Promise<void> {
  if (!subscriptionId) return;
  try {
    await gateway.cancelSubscription(subscriptionId);
  } catch (err) {
    console.error("[pix-automatico] falha ao encerrar a assinatura:", err instanceof Error ? err.name : "erro");
  }
}

/**
 * Cancela a autorização no gateway (adesão refeita, cancelamento pelo sócio ou admin). Já
 * cancelada, expirada ou recusada: nada a fazer. Lança em erro do gateway, para quem chama
 * decidir (o cancelamento do sócio não pode fingir que parou de cobrar).
 */
export async function cancelPixAutomaticAuthorization(
  gateway: SubscriptionGateway,
  authorizationId: string
): Promise<void> {
  if (!isValidPixAutomaticAuthorizationId(authorizationId)) return;
  if (!gateway.cancelPixAutomaticAuthorization || !gateway.getPixAutomaticAuthorization) {
    throw new Error("Gateway sem Pix Automático.");
  }
  const auth = await gateway.getPixAutomaticAuthorization(authorizationId);
  if (auth.status !== "CREATED" && auth.status !== "ACTIVE") return;
  await gateway.cancelPixAutomaticAuthorization(authorizationId);
}

/**
 * Cron (rede de segurança): sócios do Pix Automático ainda sem assinatura vinculada —
 * pendentes recentes (webhook perdido) e ativos à espera da assinatura criada pelo gateway —
 * e trocas de plano em andamento (nova autorização aguardando o pagador).
 */
export async function syncPendingPixAutomaticMembers(limit = 50): Promise<{ checked: number; activated: number }> {
  const db = await getDb();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      authorizationId: members.pixAutomaticAuthorizationId,
      pendingAuthorizationId: members.pixAutomaticPendingAuthorizationId,
      subscriptionId: members.subscriptionId,
      status: members.status,
      createdAt: members.createdAt,
    })
    .from(members)
    .where(
      and(
        eq(members.paymentMethod, "pix_automatic"),
        ne(members.status, "cancelled"),
        or(isNull(members.subscriptionId), isNotNull(members.pixAutomaticPendingAuthorizationId))
      )
    )
    .limit(limit);
  let checked = 0;
  let activated = 0;
  for (const r of rows) {
    try {
      if (r.pendingAuthorizationId) {
        checked++;
        await syncMemberPixAutomatic(r.pendingAuthorizationId);
      }
      if (!r.subscriptionId && r.authorizationId && !(r.status === "pending" && r.createdAt < since)) {
        checked++;
        if ((await syncMemberPixAutomatic(r.authorizationId)) === "active" && r.status === "pending") activated++;
      }
    } catch (err) {
      console.error("[pix-automatico] falha no cron:", err instanceof Error ? err.name : "erro");
    }
  }
  return { checked, activated };
}
