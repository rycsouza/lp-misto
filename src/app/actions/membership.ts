"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getDb } from "@/lib/db/client";
import {
  members,
  membershipPlans,
  membershipBenefits,
  planBenefits,
} from "@/lib/db/schema";
import { and, asc, eq, isNotNull, or } from "drizzle-orm";
import { generateMemberCardToken, validateCPF, normalizeCPF, normalizePhone } from "@/lib/membership/utils";
import { sendMemberWelcomeEmail } from "@/lib/email";
import { z } from "zod";
import { requireAdmin, requireModule } from "@/lib/admin/auth-guard";
import { logAudit } from "@/lib/audit";
import { checkCardAttemptLimit, CARD_RATE_LIMIT_ERROR } from "@/lib/payment/card-ratelimit";
import { resolveCustomerCpf } from "@/lib/customers/cpf";
import { withStoredIdentity } from "@/lib/customers/identity";
import { currentTenantSlug, tenantRead } from "@/lib/db/queries";
import { isFirstMonthPromoActive, safeCardColor } from "@/lib/membership/plan-benefits";
import { decidePromo, isPromoCandidate, type PromoDecision } from "@/lib/membership/promo";
import { parseGatewayDate } from "@/lib/membership/status";
import { todayBrasilia } from "@/lib/date";

// ─── PUBLIC PLAN LISTING ─────────────────────────────────────────────────────

export interface PublicPlanBenefit {
  id: string;
  label: string;
  order: number;
  /** Valor específico do plano para este benefício (ex.: "3 segundos"). */
  detail: string | null;
}

export interface PublicPlan {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string | null;
  priceCents: number;
  ticketDiscountPct: number;
  productDiscountPct: number;
  freeTicketsPerHomeGame: number;
  highlight: boolean;
  highlightLabel: string | null;
  /** Cor do cartão (#rrggbb) ou null = cor primária do clube. */
  cardColor: string | null;
  /** Promoção "1º mês grátis" vigente agora (data-limite já considerada). */
  promoFirstMonthFree: boolean;
  /** Fim da promoção (ISO), só quando a promoção está vigente e tem data-limite. */
  promoEndsAt: string | null;
  benefits: PublicPlanBenefit[];
}

export async function getPublicMembershipPlans(): Promise<PublicPlan[]> {
  const tenant = await currentTenantSlug();
  const db = await getDb();
  return tenantRead("getPublicMembershipPlans", tenant, async () => {
    const plans = await db
      .select()
      .from(membershipPlans)
      .where(eq(membershipPlans.active, true))
      .orderBy(asc(membershipPlans.order), asc(membershipPlans.createdAt));

    if (plans.length === 0) return [];

    const allPlanBenefits = await db
      .select({
        planId: planBenefits.planId,
        benefitId: planBenefits.benefitId,
        label: membershipBenefits.label,
        order: membershipBenefits.order,
        detail: planBenefits.detail,
      })
      .from(planBenefits)
      .innerJoin(membershipBenefits, eq(planBenefits.benefitId, membershipBenefits.id))
      .where(eq(planBenefits.included, true))
      .orderBy(asc(membershipBenefits.order));

    const now = new Date();
    return plans.map((plan) => {
      const promoActive = isFirstMonthPromoActive(plan, now);
      return {
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        icon: plan.icon,
        description: plan.description ?? null,
        priceCents: plan.priceCents,
        ticketDiscountPct: plan.ticketDiscountPct,
        productDiscountPct: plan.productDiscountPct,
        freeTicketsPerHomeGame: plan.freeTicketsPerHomeGame,
        highlight: plan.highlight,
        highlightLabel: plan.highlightLabel?.trim() || null,
        cardColor: safeCardColor(plan.cardColor),
        promoFirstMonthFree: promoActive,
        promoEndsAt: promoActive && plan.promoEndsAt ? plan.promoEndsAt.toISOString() : null,
        benefits: allPlanBenefits
          .filter((pb) => pb.planId === plan.id)
          .map((pb) => ({
            id: pb.benefitId,
            label: pb.label,
            order: pb.order,
            detail: pb.detail ?? null,
          })),
      };
    });
  });
}

// ─── MEMBER SIGNUP ───────────────────────────────────────────────────────────

const signupSchema = z.object({
  name: z.string().min(3, "Nome muito curto"),
  email: z.email("E-mail inválido"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
  // Opcional: cliente recorrente pode reutilizar o CPF do cadastro (resolvido
  // no servidor). Se vier, precisa ser válido.
  cpf: z.string().optional().refine((v) => !v || validateCPF(v), { message: "CPF inválido" }),
  planId: z.string().uuid("Plano inválido"),
  cardTokenId: z.string().optional(),
  asaasCardData: z.object({
    holderName: z.string().min(1),
    number: z.string().min(13),
    expiryMonth: z.string().length(2),
    expiryYear: z.string().length(4),
    ccv: z.string().min(3),
    postalCode: z.string().min(8),
    addressNumber: z.string().min(1),
  }).optional(),
  // Promoção 1º mês grátis: quando já foi usada, só cobra hoje se o cliente confirmar.
  acceptFullPriceIfPromoUnavailable: z.boolean().optional(),
  _hp: z.string().optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;

export interface SignupResult {
  success: boolean;
  memberId?: string;
  /** Token da carteirinha (link /socios/carteirinha?token=…) — acompanhar o status. */
  cardToken?: string;
  /** "already_member": e-mail já é sócio ativo → a UI aponta para a carteirinha.
   *  "promo_unavailable": o 1º mês grátis já foi usado; nada foi cobrado. A UI pede confirmação. */
  code?: "already_member" | "promo_unavailable";
  /** "applied": 1º mês grátis (sócio ativo na hora). "full_price_after_use": cobrança cheia após uso. */
  promo?: "applied" | "full_price_after_use";
  /** Data da 1ª cobrança (AAAA-MM-DD, Brasília) quando a promoção foi aplicada. */
  firstChargeDate?: string;
  paymentMethod?: "card" | "pix" | "redirect" | "immediate";
  pixQrCode?: string;
  pixQrCodeUrl?: string;
  initPoint?: string;
  error?: string;
}

export async function signupMember(input: SignupInput): Promise<SignupResult> {
  // Honeypot check
  if (input._hp) return { success: false, error: "Bot detectado." };

  // Cliente recorrente pode não reenviar nome/e-mail (lookup só devolve mascarado).
  const parsed = signupSchema.safeParse(await withStoredIdentity(input));
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { name, email, whatsapp, cpf, planId, cardTokenId, asaasCardData, acceptFullPriceIfPromoUnavailable } =
    parsed.data;
  const wantsCard = !!(cardTokenId || asaasCardData);

  // Anti card-testing: adesão com cartão consome o mesmo limite do checkout.
  if (wantsCard && !(await checkCardAttemptLimit({ phone: whatsapp, email }))) {
    return { success: false, error: CARD_RATE_LIMIT_ERROR };
  }

  // CPF informado vence; sem ele, usa o do cadastro (o valor nunca vai ao client).
  const effectiveCpf = await resolveCustomerCpf(whatsapp.replace(/\D/g, ""), cpf);
  if (!effectiveCpf) {
    return { success: false, error: "Informe o CPF." };
  }

  const db = await getDb();
  const normalizedCPF = normalizeCPF(effectiveCpf);
  const normalizedPhone = normalizePhone(whatsapp);
  const emailLower = email.toLowerCase();

  // Check plan exists and is active
  const [plan] = await db
    .select()
    .from(membershipPlans)
    .where(eq(membershipPlans.id, planId))
    .limit(1);

  if (!plan || !plan.active) {
    return { success: false, error: "Plano não encontrado ou inativo." };
  }

  // Check if member already exists with this email
  const [existing] = await db
    .select({
      id: members.id,
      status: members.status,
      subscriptionId: members.subscriptionId,
      gatewaySlug: members.gatewaySlug,
    })
    .from(members)
    .where(eq(members.email, emailLower))
    .limit(1);

  const alreadyMember: SignupResult = {
    success: false,
    code: "already_member",
    error: "Este e-mail já é sócio. Entre na sua conta para ver a carteirinha.",
  };
  // Suspenso também: o caminho é pagar a mensalidade em aberto pela carteirinha.
  if (existing && (existing.status === "active" || existing.status === "suspended")) return alreadyMember;

  // Gateway ativo, lido uma vez (a promoção depende dele). Com cartão, sem gateway
  // (ou com falha ao carregá-lo) não há cobrança: erro, sem gravar nada. Sem cartão
  // segue para a ativação manual, como antes.
  const { getSubscriptionGateway } = await import("@/lib/payment/subscription-factory");
  let active: Awaited<ReturnType<typeof getSubscriptionGateway>> = null;
  try {
    active = await getSubscriptionGateway();
  } catch (err) {
    console.error("Subscription gateway error:", err);
  }
  if (wantsCard && !active) return { success: false, error: CARD_FAILED_ERROR };

  // Nova tentativa de quem ficou pendente: a assinatura anterior pode ter sido
  // paga (webhook atrasado) — confere no gateway antes de qualquer outra coisa.
  if (existing?.status === "pending" && existing.subscriptionId) {
    const { syncMemberSubscription } = await import("@/lib/membership/sync");
    const synced = await syncMemberSubscription(existing.subscriptionId).catch(() => null);
    if (synced === "active") return alreadyMember;
  }

  // Promoção 1º mês grátis: decide ANTES de cancelar a assinatura anterior ou gravar
  // qualquer coisa, para o "promo_unavailable" não deixar o cadastro mexido.
  // Só o cartão enviado direto ao Asaas (asaasCardData) cria assinatura com cartão lá;
  // um cardTokenId (Mercado Pago) não vira "cartão" para a promoção.
  const paymentMethod = asaasCardData ? "card" : "pix";
  const gatewaySlug = active?.slug ?? null;
  const today = todayBrasilia();
  const eligible =
    isPromoCandidate({ plan, paymentMethod, gatewaySlug }) &&
    !(await hasUsedFirstMonthFree(db, { email: emailLower, cpf: normalizedCPF }));
  const promo = decidePromo({
    plan,
    paymentMethod,
    gatewaySlug,
    eligible,
    acceptFullPriceIfUnavailable: acceptFullPriceIfPromoUnavailable === true,
    today,
  });
  if (promo.action === "blocked") {
    return { success: false, code: "promo_unavailable", error: PROMO_UNAVAILABLE_ERROR };
  }

  // Assinatura anterior (pendente, nunca paga): cancela no gateway para não deixar
  // uma assinatura órfã gerando cobrança todo mês.
  if (existing?.status === "pending" && existing.subscriptionId) {
    try {
      if (active && active.slug === existing.gatewaySlug) {
        await active.gateway.cancelSubscription(existing.subscriptionId);
      }
    } catch (err) {
      console.error("[signupMember] falha ao cancelar assinatura anterior:", err);
    }
  }

  // Generate card token
  const memberCardToken = generateMemberCardToken();

  // Create or update member record (pending status)
  let memberId: string;
  if (existing) {
    await db
      .update(members)
      .set({
        name,
        whatsapp: normalizedPhone,
        cpf: normalizedCPF,
        planId,
        status: "pending",
        memberCardToken,
        cancelledAt: null,
        // Desvincula a assinatura anterior (cancelada acima): um webhook atrasado
        // dela não pode ativar este cadastro. A nova é gravada após a criação.
        subscriptionId: null,
      })
      .where(eq(members.id, existing.id));
    memberId = existing.id;
  } else {
    const [newMember] = await db
      .insert(members)
      .values({
        name,
        email: emailLower,
        whatsapp: normalizedPhone,
        cpf: normalizedCPF,
        planId,
        status: "pending",
        memberCardToken,
      })
      .returning({ id: members.id });
    memberId = newMember.id;
  }

  // Create subscription via active gateway
  try {
    const headersList = await headers();
    const remoteIp =
      headersList.get("cf-connecting-ip") ??
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headersList.get("x-real-ip") ??
      undefined;

    if (active) {
      const result = await active.gateway.createSubscription({
        memberName: name,
        memberEmail: emailLower,
        memberPhone: normalizedPhone,
        cpf: normalizedCPF,
        externalRef: memberId,
        planName: plan.name,
        amountCents: plan.priceCents,
        cardTokenId,
        asaasCardData,
        remoteIp,
        // 1º mês grátis: a 1ª cobrança vence no mesmo dia do mês seguinte.
        firstDueDate: promo.action === "apply" ? promo.firstDueDate : undefined,
      });

      // Mês grátis: a criação com cartão (HTTP 2xx) já aceitou o cartão; recusa → erro
      // (catch abaixo) e o sócio segue pendente, sem benefício.
      const trialEndsAt = promo.action === "apply" ? parseGatewayDate(promo.firstDueDate) : null;

      await db
        .update(members)
        .set({
          gatewaySlug: active.slug,
          gatewayCustomerId: result.gatewayCustomerId,
          // keep asaasCustomerId populated for asaas gateway (backward compat)
          asaasCustomerId: active.slug.startsWith("asaas") ? result.gatewayCustomerId : undefined,
          subscriptionId: result.subscriptionId,
          nextBillingDate: trialEndsAt ?? (result.nextDueDate ? new Date(result.nextDueDate) : undefined),
          // Mês grátis: sócio ativo na hora, em trial até a 1ª cobrança (ainda sem hasPaid).
          ...(trialEndsAt ? { status: "active" as const, trialEndsAt } : {}),
        })
        .where(eq(members.id, memberId));

      // Mock gateway: immediately activate
      if (result.paymentMethod === "immediate") {
        await db
          .update(members)
          .set({
            status: "active",
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          })
          .where(eq(members.id, memberId));
      }

      // Mesmo e-mail de boas-vindas da ativação por pagamento.
      if (trialEndsAt) sendMemberWelcomeEmail(memberId).catch(console.error);

      revalidatePath("/admin/socios");
      return {
        success: true,
        memberId,
        cardToken: memberCardToken,
        paymentMethod: result.paymentMethod,
        pixQrCode: result.pixQrCode,
        pixQrCodeUrl: result.pixQrCodeUrl,
        initPoint: result.initPoint,
        ...promoResultFields(promo),
      };
    }
  } catch (err) {
    console.error("Subscription gateway error:", err);
    // Com cartão, falha no gateway (recusa, permissão, rede) NÃO pode virar
    // "sucesso": o torcedor acharia que assinou. O sócio fica pendente.
    if (wantsCard) {
      revalidatePath("/admin/socios");
      return { success: false, error: CARD_FAILED_ERROR };
    }
    // Fall through to manual activation mode
  }

  // No gateway configured — create member as pending (manual activation)
  revalidatePath("/admin/socios");
  return { success: true, memberId, cardToken: memberCardToken };
}

const CARD_FAILED_ERROR = "Não foi possível processar o cartão. Confira os dados ou tente outro cartão.";
const PROMO_UNAVAILABLE_ERROR =
  "A promoção de 1º mês grátis já foi usada por esta pessoa. Para assinar, confirme a cobrança da mensalidade hoje.";

/** Já teve mês grátis ou mensalidade paga (mesmo e-mail ou mesmo CPF)? Um mês grátis por pessoa. */
async function hasUsedFirstMonthFree(
  db: Awaited<ReturnType<typeof getDb>>,
  who: { email: string; cpf: string }
): Promise<boolean> {
  const [hit] = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        or(eq(members.email, who.email), eq(members.cpf, who.cpf)),
        or(isNotNull(members.trialEndsAt), eq(members.hasPaid, true))
      )
    )
    .limit(1);
  return !!hit;
}

function promoResultFields(promo: PromoDecision): Pick<SignupResult, "promo" | "firstChargeDate"> {
  if (promo.action === "apply") return { promo: "applied", firstChargeDate: promo.firstDueDate };
  if (promo.action === "full_price_after_use") return { promo: "full_price_after_use" };
  return {};
}

// ─── GATEWAY PUBLIC KEY (safe to expose to client) ───────────────────────────

export async function getActiveGatewayInfo(): Promise<{
  slug: string;
  publicKey: string | null;
} | null> {
  try {
    const { getDb } = await import("@/lib/db/client");
    const db = await getDb();
    const { paymentGateways } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const { decrypt } = await import("@/lib/payment/encryption");

    const [gw] = await db
      .select()
      .from(paymentGateways)
      .where(eq(paymentGateways.active, true))
      .limit(1);

    if (!gw) return process.env.NODE_ENV === "development" ? { slug: "mock", publicKey: null } : null;

    const creds = JSON.parse(decrypt(gw.credentials)) as Record<string, unknown>;
    return {
      slug: gw.slug,
      publicKey: (creds.publicKey as string | undefined) ?? null,
    };
  } catch (err) {
    console.error("getActiveGatewayInfo error:", err);
    return null;
  }
}

// ─── STATUS DA ADESÃO (tela de sucesso / PIX) ────────────────────────────────

const CARD_TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Status da assinatura pelo token da carteirinha (segredo do próprio sócio).
 * Pendente → reconsulta o gateway (limite por sócio), cobrindo webhook atrasado.
 * Devolve só o status — nenhum dado pessoal.
 */
export async function getMembershipStatus(
  cardToken: string
): Promise<{ status: "pending" | "active" | "suspended" | "cancelled" | "not_found" }> {
  if (!CARD_TOKEN_RE.test(cardToken ?? "")) return { status: "not_found" };
  const db = await getDb();
  const [member] = await db
    .select({ id: members.id, status: members.status })
    .from(members)
    .where(eq(members.memberCardToken, cardToken))
    .limit(1);
  if (!member) return { status: "not_found" };
  if (member.status !== "pending") return { status: member.status };

  const { rateLimit } = await import("@/lib/ratelimit");
  const { ok } = await rateLimit(`rl:member-status:${member.id}`, 1, 5);
  if (!ok) return { status: "pending" };
  try {
    const { syncMemberById } = await import("@/lib/membership/sync");
    const synced = await syncMemberById(member.id);
    return { status: synced === "active" ? "active" : "pending" };
  } catch {
    return { status: "pending" };
  }
}

// ─── WEBHOOK: ACTIVATE / CANCEL ──────────────────────────────────────────────
// Movidas para "@/lib/membership/subscription" (funções internas do webhook, não
// server actions) — evita expor um endpoint que ativaria sócio sem pagamento.

/**
 * Admin: reconsulta no gateway o pagamento da assinatura de um sócio pendente e
 * ativa se houver cobrança paga. Não ativa sem pagamento (diferente de
 * activateMemberById, que é manual).
 */
export async function syncMemberPaymentAdmin(
  memberId: string
): Promise<{ success: boolean; status?: string; error?: string }> {
  await requireModule("socios");
  if (!z.string().uuid().safeParse(memberId).success) {
    return { success: false, error: "Sócio inválido." };
  }
  try {
    const { syncMemberById } = await import("@/lib/membership/sync");
    const status = await syncMemberById(memberId);
    revalidatePath("/admin/socios");
    return { success: true, status };
  } catch (err) {
    console.error("syncMemberPaymentAdmin error:", err);
    return { success: false, error: "Não foi possível consultar o gateway agora." };
  }
}

/**
 * Ativação MANUAL (cortesia/acerto) — sem pagamento no gateway. Só admin, com
 * auditoria. Usada pelo painel e pelo agente do sistema.
 */
export async function activateMemberById(memberId: string): Promise<void> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(memberId).success) throw new Error("Sócio inválido.");
  const db = await getDb();
  const [before] = await db
    .select({ status: members.status })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);
  if (!before) throw new Error("Sócio não encontrado.");
  await db
    .update(members)
    .set({
      status: "active",
      cancelledAt: null,
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    .where(eq(members.id, memberId));
  await logAudit("member_manual_activate", "member", memberId, { from: before.status });
  revalidatePath("/admin/socios");
  revalidatePath(`/admin/socios/${memberId}`);
  if (before.status === "pending") sendMemberWelcomeEmail(memberId).catch(console.error);
}

// ─── ADMIN: DETALHE E AÇÕES DO SÓCIO ─────────────────────────────────────────

export interface AdminMemberDetail {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  cpfMasked: string | null;
  planName: string | null;
  planPriceCents: number | null;
  status: string;
  createdAt: Date;
  nextBillingDate: Date | null;
  cancelledAt: Date | null;
  /** Fim do 1º mês grátis (NULL = sem promoção). */
  trialEndsAt: Date | null;
  /** Já houve mensalidade paga. */
  hasPaid: boolean;
  gatewaySlug: string | null;
  subscriptionId: string | null;
  cardPath: string | null;
}

/** Detalhe do sócio no admin. CPF mascarado (o painel não precisa do número). */
export async function getAdminMemberDetail(memberId: string): Promise<AdminMemberDetail | null> {
  await requireModule("socios");
  if (!z.string().uuid().safeParse(memberId).success) return null;
  const db = await getDb();
  const [m] = await db
    .select({
      id: members.id,
      name: members.name,
      email: members.email,
      whatsapp: members.whatsapp,
      cpf: members.cpf,
      status: members.status,
      createdAt: members.createdAt,
      nextBillingDate: members.nextBillingDate,
      cancelledAt: members.cancelledAt,
      trialEndsAt: members.trialEndsAt,
      hasPaid: members.hasPaid,
      gatewaySlug: members.gatewaySlug,
      subscriptionId: members.subscriptionId,
      memberCardToken: members.memberCardToken,
      planName: membershipPlans.name,
      planPriceCents: membershipPlans.priceCents,
    })
    .from(members)
    .leftJoin(membershipPlans, eq(members.planId, membershipPlans.id))
    .where(eq(members.id, memberId))
    .limit(1);
  if (!m) return null;
  const cpfDigits = m.cpf?.replace(/\D/g, "") ?? "";
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    whatsapp: m.whatsapp,
    cpfMasked: cpfDigits.length === 11 ? `***.${cpfDigits.slice(3, 6)}.***-**` : null,
    planName: m.planName,
    planPriceCents: m.planPriceCents,
    status: m.status,
    createdAt: m.createdAt,
    nextBillingDate: m.nextBillingDate,
    cancelledAt: m.cancelledAt,
    trialEndsAt: m.trialEndsAt,
    hasPaid: m.hasPaid,
    gatewaySlug: m.gatewaySlug,
    subscriptionId: m.subscriptionId,
    cardPath: m.memberCardToken ? `/socios/carteirinha?token=${m.memberCardToken}` : null,
  };
}

/** Histórico de mensalidades direto do gateway (fonte da verdade). */
export async function getAdminMemberPayments(memberId: string): Promise<{
  payments: { dueDate: string | null; valueCents: number; status: string; invoiceUrl: string | null }[];
  error?: string;
}> {
  await requireModule("socios");
  if (!z.string().uuid().safeParse(memberId).success) return { payments: [] };
  const db = await getDb();
  const [m] = await db
    .select({ subscriptionId: members.subscriptionId, gatewaySlug: members.gatewaySlug })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);
  if (!m?.subscriptionId) return { payments: [] };
  try {
    const { getSubscriptionGateway } = await import("@/lib/payment/subscription-factory");
    const active = await getSubscriptionGateway();
    if (!active || active.slug !== m.gatewaySlug || !active.gateway.listSubscriptionPayments) {
      return { payments: [], error: "O gateway desta assinatura não permite consultar o histórico." };
    }
    return { payments: await active.gateway.listSubscriptionPayments(m.subscriptionId) };
  } catch (err) {
    console.error("getAdminMemberPayments error:", err);
    return { payments: [], error: "Não foi possível consultar o gateway agora." };
  }
}

/** Reenvia o link da carteirinha para o e-mail cadastrado do sócio. */
export async function resendMemberCardAdmin(memberId: string): Promise<{ success: boolean; error?: string }> {
  await requireModule("socios");
  if (!z.string().uuid().safeParse(memberId).success) return { success: false, error: "Sócio inválido." };
  const { sendMemberCardLinkEmail } = await import("@/lib/email");
  const ok = await sendMemberCardLinkEmail(memberId);
  if (ok) await logAudit("member_card_resend", "member", memberId);
  return ok ? { success: true } : { success: false, error: "Não foi possível enviar o e-mail." };
}

/** Cancela a assinatura (gateway + banco). Só admin; benefícios até o fim do período. */
export async function cancelMemberAdmin(
  memberId: string
): Promise<{ success: boolean; benefitsUntil?: string | null; error?: string }> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(memberId).success) return { success: false, error: "Sócio inválido." };
  const { cancelMembership } = await import("@/lib/membership/cancel");
  const r = await cancelMembership(memberId);
  if (!r.ok) {
    const msg =
      r.error === "already_cancelled"
        ? "Esta assinatura já está cancelada."
        : r.error === "gateway_error"
        ? "Não foi possível cancelar no gateway. Nada foi alterado."
        : "Sócio não encontrado.";
    return { success: false, error: msg };
  }
  await logAudit("member_cancel", "member", memberId, { by: "admin" });
  revalidatePath(`/admin/socios/${memberId}`);
  return { success: true, benefitsUntil: r.benefitsUntil?.toISOString() ?? null };
}
