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
  const db = await getDb();
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
}

// ─── MEMBER SIGNUP ───────────────────────────────────────────────────────────

const signupSchema = z.object({
  name: z.string().min(3, "Nome muito curto"),
  email: z.email("E-mail inválido"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
  cpf: z.string().refine((v) => validateCPF(v), { message: "CPF inválido" }),
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
  paymentMethod?: "card" | "pix" | "redirect" | "immediate";
  pixQrCode?: string;
  pixQrCodeUrl?: string;
  initPoint?: string;
  error?: string;
}

export async function signupMember(input: SignupInput): Promise<SignupResult> {
  // Honeypot check
  if (input._hp) return { success: false, error: "Bot detectado." };

  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const db = await getDb();
  const { name, email, whatsapp, cpf, planId, cardTokenId, asaasCardData } = parsed.data;
  const normalizedCPF = normalizeCPF(cpf);
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
    .select({ id: members.id, status: members.status })
    .from(members)
    .where(eq(members.email, email.toLowerCase()))
    .limit(1);

  if (existing && existing.status === "active") {
    return { success: false, error: "Este e-mail já possui uma assinatura ativa." };
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
        paymentMethod: result.paymentMethod,
        pixQrCode: result.pixQrCode,
        pixQrCodeUrl: result.pixQrCodeUrl,
        initPoint: result.initPoint,
      };
    }
  } catch (err) {
    console.error("Subscription gateway error:", err);
    // Fall through to manual activation mode
  }

  // No gateway configured — create member as pending (manual activation)
  revalidatePath("/admin/socios");
  return { success: true, memberId };
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

// ─── MEMBER LOOKUP FOR CHECKOUT DISCOUNT ─────────────────────────────────────

export interface MemberDiscountInfo {
  ticketDiscountPct: number;
  productDiscountPct: number;
  planName: string;
}

export async function getMemberDiscountForEmail(
  email: string
): Promise<MemberDiscountInfo | null> {
  if (!email) return null;
  const db = await getDb();
  const rows = await db
    .select({
      status: members.status,
      ticketDiscountPct: membershipPlans.ticketDiscountPct,
      productDiscountPct: membershipPlans.productDiscountPct,
      planName: membershipPlans.name,
    })
    .from(members)
    .innerJoin(membershipPlans, eq(members.planId, membershipPlans.id))
    .where(eq(members.email, email.toLowerCase()))
    .limit(1);

  const row = rows[0];
  if (!row || row.status !== "active") return null;
  if (row.ticketDiscountPct === 0 && row.productDiscountPct === 0) return null;

  return {
    ticketDiscountPct: row.ticketDiscountPct,
    productDiscountPct: row.productDiscountPct,
    planName: row.planName,
  };
}

// ─── MEMBER CARD LOOKUP ──────────────────────────────────────────────────────

export interface MemberCardInfo {
  name: string;
  email: string;
  planName: string;
  status: string;
  memberSince: string;
}

export async function getMemberByCardToken(
  token: string
): Promise<MemberCardInfo | null> {
  if (!token) return null;
  const db = await getDb();
  const rows = await db
    .select({
      name: members.name,
      email: members.email,
      status: members.status,
      createdAt: members.createdAt,
      planName: membershipPlans.name,
    })
    .from(members)
    .leftJoin(membershipPlans, eq(members.planId, membershipPlans.id))
    .where(eq(members.memberCardToken, token))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    name: row.name,
    email: row.email,
    planName: row.planName ?? "—",
    status: row.status,
    memberSince: row.createdAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
  };
}

// ─── WEBHOOK: ACTIVATE / CANCEL ──────────────────────────────────────────────

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

export async function activateMemberById(memberId: string): Promise<void> {
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
