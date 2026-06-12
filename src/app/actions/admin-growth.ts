"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import {
  leads,
  upsellOffers,
  membershipPlans,
  membershipBenefits,
  planBenefits,
  members,
} from "@/lib/db/schema";
import {
  eq,
  desc,
  asc,
  ilike,
  and,
  or,
  count,
  inArray,
  sql,
} from "drizzle-orm";

// ─── LEADS TYPES ─────────────────────────────────────────────────────────────

export interface LeadRow {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  source: string;
  createdAt: Date;
}

// ─── LEADS ACTIONS ───────────────────────────────────────────────────────────

export async function getAdminLeads(params: {
  page: number;
  source?: string;
  search?: string;
  limit?: number;
}): Promise<{ rows: LeadRow[]; total: number }> {
  const { page, source, search, limit = 20 } = params;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (source && source !== "all") {
    conditions.push(
      eq(
        leads.source,
        source as
          | "ticket_checkout"
          | "membership_interest"
          | "sponsorship_interest"
          | "newsletter"
          | "history_gallery"
      )
    );
  }

  if (search && search.trim()) {
    const pattern = `%${search.trim()}%`;
    conditions.push(
      or(ilike(leads.name, pattern), ilike(leads.email, pattern))
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ total: count() })
    .from(leads)
    .where(whereClause);

  const rows = await db
    .select({
      id: leads.id,
      name: leads.name,
      email: leads.email,
      whatsapp: leads.whatsapp,
      source: leads.source,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(whereClause)
    .orderBy(desc(leads.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      whatsapp: r.whatsapp ?? null,
      source: r.source,
      createdAt: r.createdAt,
    })),
    total: Number(totalRow.total),
  };
}

export async function exportLeadsCSV(source?: string): Promise<string> {
  const conditions = [];

  if (source && source !== "all") {
    conditions.push(
      eq(
        leads.source,
        source as
          | "ticket_checkout"
          | "membership_interest"
          | "sponsorship_interest"
          | "newsletter"
          | "history_gallery"
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      name: leads.name,
      email: leads.email,
      whatsapp: leads.whatsapp,
      source: leads.source,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(whereClause)
    .orderBy(desc(leads.createdAt));

  const header = "Nome,Email,WhatsApp,Fonte,Data";
  const csvRows = rows.map((r) => {
    const date = r.createdAt.toLocaleDateString("pt-BR");
    const name = `"${r.name.replace(/"/g, '""')}"`;
    const email = `"${r.email.replace(/"/g, '""')}"`;
    const whatsapp = r.whatsapp ? `"${r.whatsapp}"` : "";
    const src = r.source;
    return `${name},${email},${whatsapp},${src},${date}`;
  });

  return [header, ...csvRows].join("\n");
}

export async function deleteLead(
  id: string
): Promise<{ success: boolean }> {
  await db.delete(leads).where(eq(leads.id, id));
  revalidatePath("/admin/leads");
  return { success: true };
}

// ─── UPSELL TYPES ────────────────────────────────────────────────────────────

export interface UpsellOfferRow {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  triggerProductId: string | null;
  offerType: string;
  offerProductId: string | null;
  offerTicketType: string | null;
  originalPriceCents: number;
  discountPct: number;
  active: boolean;
  minOrderCents: number;
  timerSeconds: number;
  createdAt: Date;
}

export interface UpsellOfferInput {
  name: string;
  description?: string | null;
  triggerType: "any" | "ticket" | "product" | "specific_product";
  triggerProductId?: string | null;
  offerType: "ticket" | "product";
  offerProductId?: string | null;
  offerTicketType?: "inteira" | "meia" | null;
  originalPriceCents: number;
  discountPct: number;
  active: boolean;
  minOrderCents: number;
  timerSeconds: number;
}

// ─── UPSELL ACTIONS ──────────────────────────────────────────────────────────

export async function getAdminUpsellOffers(): Promise<UpsellOfferRow[]> {
  const rows = await db
    .select()
    .from(upsellOffers)
    .orderBy(desc(upsellOffers.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    triggerType: r.triggerType,
    triggerProductId: r.triggerProductId ?? null,
    offerType: r.offerType,
    offerProductId: r.offerProductId ?? null,
    offerTicketType: r.offerTicketType ?? null,
    originalPriceCents: r.originalPriceCents,
    discountPct: r.discountPct,
    active: r.active,
    minOrderCents: r.minOrderCents,
    timerSeconds: r.timerSeconds,
    createdAt: r.createdAt,
  }));
}

export async function getAdminUpsellOfferById(
  id: string
): Promise<UpsellOfferRow | null> {
  const rows = await db
    .select()
    .from(upsellOffers)
    .where(eq(upsellOffers.id, id))
    .limit(1);

  if (!rows[0]) return null;

  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    triggerType: r.triggerType,
    triggerProductId: r.triggerProductId ?? null,
    offerType: r.offerType,
    offerProductId: r.offerProductId ?? null,
    offerTicketType: r.offerTicketType ?? null,
    originalPriceCents: r.originalPriceCents,
    discountPct: r.discountPct,
    active: r.active,
    minOrderCents: r.minOrderCents,
    timerSeconds: r.timerSeconds,
    createdAt: r.createdAt,
  };
}

export async function createUpsellOffer(
  data: UpsellOfferInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const [offer] = await db
      .insert(upsellOffers)
      .values({
        name: data.name,
        description: data.description ?? null,
        triggerType: data.triggerType,
        triggerProductId: data.triggerProductId ?? null,
        offerType: data.offerType,
        offerProductId: data.offerProductId ?? null,
        offerTicketType: data.offerTicketType ?? null,
        originalPriceCents: data.originalPriceCents,
        discountPct: data.discountPct,
        active: data.active,
        minOrderCents: data.minOrderCents,
        timerSeconds: data.timerSeconds,
      })
      .returning({ id: upsellOffers.id });

    revalidatePath("/admin/upsell");
    return { success: true, id: offer.id };
  } catch (err) {
    console.error("createUpsellOffer error:", err);
    return { success: false, error: "Erro ao criar oferta de upsell" };
  }
}

export async function updateUpsellOffer(
  id: string,
  data: Partial<UpsellOfferInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: Partial<typeof upsellOffers.$inferInsert> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description ?? null;
    if (data.triggerType !== undefined) updateData.triggerType = data.triggerType;
    if (data.triggerProductId !== undefined)
      updateData.triggerProductId = data.triggerProductId ?? null;
    if (data.offerType !== undefined) updateData.offerType = data.offerType;
    if (data.offerProductId !== undefined)
      updateData.offerProductId = data.offerProductId ?? null;
    if (data.offerTicketType !== undefined)
      updateData.offerTicketType = data.offerTicketType ?? null;
    if (data.originalPriceCents !== undefined)
      updateData.originalPriceCents = data.originalPriceCents;
    if (data.discountPct !== undefined) updateData.discountPct = data.discountPct;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.minOrderCents !== undefined)
      updateData.minOrderCents = data.minOrderCents;
    if (data.timerSeconds !== undefined)
      updateData.timerSeconds = data.timerSeconds;

    await db
      .update(upsellOffers)
      .set(updateData)
      .where(eq(upsellOffers.id, id));

    revalidatePath("/admin/upsell");
    revalidatePath(`/admin/upsell/${id}`);
    return { success: true };
  } catch (err) {
    console.error("updateUpsellOffer error:", err);
    return { success: false, error: "Erro ao atualizar oferta de upsell" };
  }
}

export async function toggleUpsellOfferActive(
  id: string,
  active: boolean
): Promise<void> {
  await db
    .update(upsellOffers)
    .set({ active })
    .where(eq(upsellOffers.id, id));
  revalidatePath("/admin/upsell");
}

export async function deleteUpsellOffer(
  id: string
): Promise<{ success: boolean }> {
  await db.delete(upsellOffers).where(eq(upsellOffers.id, id));
  revalidatePath("/admin/upsell");
  return { success: true };
}

// ─── MEMBERSHIP TYPES ────────────────────────────────────────────────────────

export interface MembershipPlanRow {
  id: string;
  name: string;
  slug: string;
  icon: string;
  priceCents: number;
  highlight: boolean;
  active: boolean;
  order: number;
}

export interface MembershipPlanInput {
  name: string;
  slug: string;
  icon: string;
  priceCents: number;
  highlight: boolean;
  active: boolean;
  order?: number;
}

export interface BenefitRow {
  id: string;
  label: string;
  order: number;
}

export interface MemberRow {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  planId: string | null;
  planName: string | null;
  status: string;
  createdAt: Date;
}

// ─── MEMBERSHIP PLAN ACTIONS ─────────────────────────────────────────────────

export async function getAdminMembershipPlans(): Promise<
  (MembershipPlanRow & { benefits: BenefitRow[] })[]
> {
  const plans = await db
    .select()
    .from(membershipPlans)
    .orderBy(asc(membershipPlans.order), asc(membershipPlans.createdAt));

  const allPlanBenefits = await db
    .select({
      planId: planBenefits.planId,
      benefitId: planBenefits.benefitId,
      label: membershipBenefits.label,
      order: membershipBenefits.order,
    })
    .from(planBenefits)
    .innerJoin(
      membershipBenefits,
      eq(planBenefits.benefitId, membershipBenefits.id)
    )
    .orderBy(asc(membershipBenefits.order));

  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    icon: plan.icon,
    priceCents: plan.priceCents,
    highlight: plan.highlight,
    active: plan.active,
    order: plan.order,
    benefits: allPlanBenefits
      .filter((pb) => pb.planId === plan.id)
      .map((pb) => ({
        id: pb.benefitId,
        label: pb.label,
        order: pb.order,
      })),
  }));
}

export async function createMembershipPlan(
  data: MembershipPlanInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const [plan] = await db
      .insert(membershipPlans)
      .values({
        name: data.name,
        slug: data.slug,
        icon: data.icon,
        priceCents: data.priceCents,
        highlight: data.highlight,
        active: data.active,
        order: data.order ?? 0,
      })
      .returning({ id: membershipPlans.id });

    revalidatePath("/admin/socios");
    return { success: true, id: plan.id };
  } catch (err) {
    console.error("createMembershipPlan error:", err);
    return { success: false, error: "Erro ao criar plano" };
  }
}

export async function updateMembershipPlan(
  id: string,
  data: Partial<MembershipPlanInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: Partial<typeof membershipPlans.$inferInsert> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.priceCents !== undefined) updateData.priceCents = data.priceCents;
    if (data.highlight !== undefined) updateData.highlight = data.highlight;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.order !== undefined) updateData.order = data.order;

    await db
      .update(membershipPlans)
      .set(updateData)
      .where(eq(membershipPlans.id, id));

    revalidatePath("/admin/socios");
    revalidatePath(`/admin/socios/planos/${id}`);
    return { success: true };
  } catch (err) {
    console.error("updateMembershipPlan error:", err);
    return { success: false, error: "Erro ao atualizar plano" };
  }
}

export async function toggleMembershipPlanActive(
  id: string,
  active: boolean
): Promise<void> {
  await db
    .update(membershipPlans)
    .set({ active })
    .where(eq(membershipPlans.id, id));
  revalidatePath("/admin/socios");
}

export async function deleteMembershipPlan(
  id: string
): Promise<{ success: boolean }> {
  await db.delete(membershipPlans).where(eq(membershipPlans.id, id));
  revalidatePath("/admin/socios");
  return { success: true };
}

// ─── BENEFIT ACTIONS ─────────────────────────────────────────────────────────

export async function getAdminBenefits(): Promise<BenefitRow[]> {
  const rows = await db
    .select()
    .from(membershipBenefits)
    .orderBy(asc(membershipBenefits.order), asc(membershipBenefits.createdAt));

  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    order: r.order,
  }));
}

export async function createBenefit(
  label: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const [benefit] = await db
      .insert(membershipBenefits)
      .values({ label })
      .returning({ id: membershipBenefits.id });

    revalidatePath("/admin/socios");
    return { success: true, id: benefit.id };
  } catch (err) {
    console.error("createBenefit error:", err);
    return { success: false, error: "Erro ao criar benefício" };
  }
}

export async function deleteBenefit(
  id: string
): Promise<{ success: boolean }> {
  await db.delete(membershipBenefits).where(eq(membershipBenefits.id, id));
  revalidatePath("/admin/socios");
  return { success: true };
}

export async function moveBenefitUp(id: string): Promise<void> {
  const [current] = await db
    .select({ id: membershipBenefits.id, order: membershipBenefits.order })
    .from(membershipBenefits)
    .where(eq(membershipBenefits.id, id))
    .limit(1);
  if (!current) return;

  const [prev] = await db
    .select({ id: membershipBenefits.id, order: membershipBenefits.order })
    .from(membershipBenefits)
    .where(sql`${membershipBenefits.order} < ${current.order}`)
    .orderBy(desc(membershipBenefits.order))
    .limit(1);
  if (!prev) return;

  await db.update(membershipBenefits).set({ order: prev.order }).where(eq(membershipBenefits.id, current.id));
  await db.update(membershipBenefits).set({ order: current.order }).where(eq(membershipBenefits.id, prev.id));
  revalidatePath("/admin/socios");
}

export async function moveBenefitDown(id: string): Promise<void> {
  const [current] = await db
    .select({ id: membershipBenefits.id, order: membershipBenefits.order })
    .from(membershipBenefits)
    .where(eq(membershipBenefits.id, id))
    .limit(1);
  if (!current) return;

  const [next] = await db
    .select({ id: membershipBenefits.id, order: membershipBenefits.order })
    .from(membershipBenefits)
    .where(sql`${membershipBenefits.order} > ${current.order}`)
    .orderBy(asc(membershipBenefits.order))
    .limit(1);
  if (!next) return;

  await db.update(membershipBenefits).set({ order: next.order }).where(eq(membershipBenefits.id, current.id));
  await db.update(membershipBenefits).set({ order: current.order }).where(eq(membershipBenefits.id, next.id));
  revalidatePath("/admin/socios");
}

export async function setPlanBenefits(
  planId: string,
  benefitIds: string[]
): Promise<void> {
  // Remove all existing plan-benefit links for this plan
  await db.delete(planBenefits).where(eq(planBenefits.planId, planId));

  // Insert new links
  if (benefitIds.length > 0) {
    await db.insert(planBenefits).values(
      benefitIds.map((benefitId) => ({
        planId,
        benefitId,
        included: true,
      }))
    );
  }

  revalidatePath("/admin/socios");
  revalidatePath(`/admin/socios/planos/${planId}`);
}

// ─── MEMBER ACTIONS ──────────────────────────────────────────────────────────

export async function getAdminMembers(params: {
  page: number;
  status?: string;
  planId?: string;
  search?: string;
  limit?: number;
}): Promise<{ rows: MemberRow[]; total: number }> {
  const { page, status, planId, search, limit = 20 } = params;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (status && status !== "all") {
    conditions.push(
      eq(
        members.status,
        status as "pending" | "active" | "cancelled"
      )
    );
  }

  if (planId && planId !== "all") {
    conditions.push(eq(members.planId, planId));
  }

  if (search && search.trim()) {
    const pattern = `%${search.trim()}%`;
    conditions.push(
      or(ilike(members.name, pattern), ilike(members.email, pattern))
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ total: count() })
    .from(members)
    .where(whereClause);

  const rows = await db
    .select({
      id: members.id,
      name: members.name,
      email: members.email,
      whatsapp: members.whatsapp,
      planId: members.planId,
      planName: membershipPlans.name,
      status: members.status,
      createdAt: members.createdAt,
    })
    .from(members)
    .leftJoin(membershipPlans, eq(members.planId, membershipPlans.id))
    .where(whereClause)
    .orderBy(desc(members.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      whatsapp: r.whatsapp ?? null,
      planId: r.planId ?? null,
      planName: r.planName ?? null,
      status: r.status,
      createdAt: r.createdAt,
    })),
    total: Number(totalRow.total),
  };
}

export async function updateMemberStatus(
  id: string,
  status: "pending" | "active" | "cancelled"
): Promise<void> {
  await db.update(members).set({ status }).where(eq(members.id, id));
  revalidatePath("/admin/socios");
}
