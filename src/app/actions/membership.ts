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
import { eq, asc } from "drizzle-orm";
import { generateMemberCardToken, validateCPF, normalizeCPF, normalizePhone } from "@/lib/membership/utils";
import { sendMemberWelcomeEmail } from "@/lib/email";
import { z } from "zod";
import { requireModule } from "@/lib/admin/auth-guard";
import { checkCardAttemptLimit, CARD_RATE_LIMIT_ERROR } from "@/lib/payment/card-ratelimit";
import { resolveCustomerCpf } from "@/lib/customers/cpf";
import { withStoredIdentity } from "@/lib/customers/identity";
import { currentTenantSlug, tenantRead } from "@/lib/db/queries";

// ─── PUBLIC PLAN LISTING ─────────────────────────────────────────────────────

export interface PublicPlanBenefit {
  id: string;
  label: string;
  order: number;
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
  highlight: boolean;
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
      })
      .from(planBenefits)
      .innerJoin(membershipBenefits, eq(planBenefits.benefitId, membershipBenefits.id))
      .where(eq(planBenefits.included, true))
      .orderBy(asc(membershipBenefits.order));

    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      icon: plan.icon,
      description: plan.description ?? null,
      priceCents: plan.priceCents,
      ticketDiscountPct: plan.ticketDiscountPct,
      productDiscountPct: plan.productDiscountPct,
      highlight: plan.highlight,
      benefits: allPlanBenefits
        .filter((pb) => pb.planId === plan.id)
        .map((pb) => ({ id: pb.benefitId, label: pb.label, order: pb.order })),
    }));
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
  _hp: z.string().optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;

export interface SignupResult {
  success: boolean;
  memberId?: string;
  /** Token da carteirinha (link /socios/carteirinha?token=…) — acompanhar o status. */
  cardToken?: string;
  /** "already_member": e-mail já é sócio ativo → a UI aponta para a carteirinha. */
  code?: "already_member";
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

  const { name, email, whatsapp, cpf, planId, cardTokenId, asaasCardData } = parsed.data;

  // Anti card-testing: adesão com cartão consome o mesmo limite do checkout.
  if ((cardTokenId || asaasCardData) && !(await checkCardAttemptLimit({ phone: whatsapp, email }))) {
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
    .where(eq(members.email, email.toLowerCase()))
    .limit(1);

  const alreadyMember: SignupResult = {
    success: false,
    code: "already_member",
    error: "Este e-mail já é sócio. Receba o link da sua carteirinha por e-mail.",
  };
  if (existing && existing.status === "active") return alreadyMember;

  // Nova tentativa de quem ficou pendente: a assinatura anterior pode ter sido
  // paga (webhook atrasado) — confere no gateway antes. Se não foi, cancela no
  // gateway para não deixar uma assinatura órfã gerando cobrança todo mês.
  if (existing?.status === "pending" && existing.subscriptionId) {
    const { syncMemberSubscription } = await import("@/lib/membership/sync");
    const synced = await syncMemberSubscription(existing.subscriptionId).catch(() => null);
    if (synced === "active") return alreadyMember;
    try {
      const { getSubscriptionGateway } = await import("@/lib/payment/subscription-factory");
      const current = await getSubscriptionGateway();
      if (current && current.slug === existing.gatewaySlug) {
        await current.gateway.cancelSubscription(existing.subscriptionId);
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
        email: email.toLowerCase(),
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

    const { getSubscriptionGateway } = await import("@/lib/payment/subscription-factory");
    const active = await getSubscriptionGateway();

    if (active) {
      const result = await active.gateway.createSubscription({
        memberName: name,
        memberEmail: email.toLowerCase(),
        memberPhone: normalizedPhone,
        cpf: normalizedCPF,
        externalRef: memberId,
        planName: plan.name,
        amountCents: plan.priceCents,
        cardTokenId,
        asaasCardData,
        remoteIp,
      });

      await db
        .update(members)
        .set({
          gatewaySlug: active.slug,
          gatewayCustomerId: result.gatewayCustomerId,
          // keep asaasCustomerId populated for asaas gateway (backward compat)
          asaasCustomerId: active.slug.startsWith("asaas") ? result.gatewayCustomerId : undefined,
          subscriptionId: result.subscriptionId,
          nextBillingDate: result.nextDueDate ? new Date(result.nextDueDate) : undefined,
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

      revalidatePath("/admin/socios");
      return {
        success: true,
        memberId,
        cardToken: memberCardToken,
        paymentMethod: result.paymentMethod,
        pixQrCode: result.pixQrCode,
        pixQrCodeUrl: result.pixQrCodeUrl,
        initPoint: result.initPoint,
      };
    }
  } catch (err) {
    console.error("Subscription gateway error:", err);
    // Com cartão, falha no gateway (recusa, permissão, rede) NÃO pode virar
    // "sucesso": o torcedor acharia que assinou. O sócio fica pendente.
    if (cardTokenId || asaasCardData) {
      revalidatePath("/admin/socios");
      return {
        success: false,
        error: "Não foi possível processar o cartão. Confira os dados ou tente outro cartão.",
      };
    }
    // Fall through to manual activation mode
  }

  // No gateway configured — create member as pending (manual activation)
  revalidatePath("/admin/socios");
  return { success: true, memberId, cardToken: memberCardToken };
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

// ─── MINHA CARTEIRINHA: link por e-mail ──────────────────────────────────────

/**
 * Envia o link da carteirinha para o e-mail CADASTRADO do sócio. Resposta sempre
 * genérica (não revela se o e-mail é sócio) e com limite por IP e por e-mail.
 * Seguro sem senha: o link só chega a quem controla a caixa de e-mail.
 */
export async function requestMemberCardLink(input: {
  email: string;
  _hp?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (input?._hp) return { ok: true }; // honeypot: finge sucesso
  const parsed = z.email().safeParse((input?.email ?? "").trim().toLowerCase());
  if (!parsed.success) return { ok: false, error: "Informe um e-mail válido." };
  const email = parsed.data;

  const { getClientIp, rateLimit } = await import("@/lib/ratelimit");
  const ip = await getClientIp();
  const [ipLimit, emailLimit] = await Promise.all([
    rateLimit(`rl:cardlink:ip:${ip}`, 5, 600),
    rateLimit(`rl:cardlink:em:${email}`, 3, 3600),
  ]);
  if (!ipLimit.ok) return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };
  if (!emailLimit.ok) return { ok: true }; // já enviado há pouco — não reenvia

  const db = await getDb();
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.email, email))
    .limit(1);
  if (member) {
    const { sendMemberCardLinkEmail } = await import("@/lib/email");
    await sendMemberCardLinkEmail(member.id);
  }
  return { ok: true };
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

export async function activateMemberById(memberId: string): Promise<void> {
  await requireModule("socios");
  const db = await getDb();
  await db
    .update(members)
    .set({
      status: "active",
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    .where(eq(members.id, memberId));
  revalidatePath("/admin/socios");
  sendMemberWelcomeEmail(memberId).catch(console.error);
}
