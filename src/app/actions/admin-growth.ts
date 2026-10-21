"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getDb } from "@/lib/db/client";
import { currentTenantSlug } from "@/lib/db/queries";
import {
  leads,
  upsellOffers,
  membershipPlans,
  membershipBenefits,
  planBenefits,
  members,
  siteConfig,
} from "@/lib/db/schema";
import {
  eq,
  desc,
  asc,
  ilike,
  and,
  or,
  count,
  sql,
} from "drizzle-orm";
import { requireModule } from "@/lib/admin/auth-guard";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/pagination";
import { logAudit } from "@/lib/audit";
import { MEMBERSHIP_DEFAULT_PLAN_KEY } from "@/lib/membership/default-plan";
import {
  PlanAdminError,
  benefitMatrixSchema,
  patchPlan,
  planBenefitLinksSchema,
  planFieldsSchema,
  planPatchSchema,
  replacePlanBenefits,
  savePlan,
  saveBenefitMatrix as saveBenefitMatrixRows,
  type BenefitMatrixInput,
} from "@/lib/membership/plan-admin";
import { z } from "zod";
import { toCsv } from "@/lib/admin/csv";

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
  await requireModule("leads");
  const db = await getDb();
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
  await requireModule("leads");
  const db = await getDb();
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

  // toCsv neutraliza células que começam com = + - @ (injeção de fórmula no Excel).
  return toCsv([
    ["Nome", "Email", "WhatsApp", "Fonte", "Data"],
    ...rows.map((r) => [
      r.name,
      r.email,
      r.whatsapp,
      r.source,
      r.createdAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    ]),
  ]);
}

export async function deleteLead(
  id: string
): Promise<{ success: boolean }> {
  await requireModule("leads");
  const db = await getDb();
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
  offerGameId: string | null;
  offerQuantity: number;
  originalPriceCents: number;
  discountPct: number;
  active: boolean;
  minOrderCents: number;
  minQuantity: number | null;
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
  offerTicketType?: string | null;
  offerGameId?: string | null;
  offerQuantity: number;
  originalPriceCents: number;
  discountPct: number;
  active: boolean;
  minOrderCents: number;
  minQuantity?: number | null;
  timerSeconds: number;
}

export interface ProductPickerItem {
  id: string;
  name: string;
  imageUrl: string | null;
  priceCents: number;
  category: string;
}

export async function getProductsForUpsellForm(): Promise<ProductPickerItem[]> {
  const db = await getDb();
  const { products } = await import("@/lib/db/schema");
  const rows = await db
    .select({ id: products.id, name: products.name, imageUrl: products.imageUrl, priceCents: products.priceCents, category: products.category })
    .from(products)
    .orderBy(products.name);
  return rows;
}

export interface UpsellGameOption {
  id: string;
  label: string;
  types: { code: string; name: string; priceCents: number }[];
}

/** Jogos em casa + seus tipos de ingresso resolvidos — para o seletor do upsell. */
export async function getGamesWithTicketTypesForUpsell(): Promise<UpsellGameOption[]> {
  const db = await getDb();
  const { games } = await import("@/lib/db/schema");
  const rows = await db
    .select({ id: games.id, opponent: games.opponent, competition: games.competition, date: games.date })
    .from(games)
    .where(eq(games.isHome, true))
    .orderBy(desc(games.date))
    .limit(30);

  const { getTicketTypesForGames } = await import("@/lib/tickets/resolve");
  const { getSiteConfig } = await import("@/lib/config");
  const config = await getSiteConfig();
  const typesByGame = await getTicketTypesForGames(rows.map((r) => ({ id: r.id })), config);

  return rows.map((r) => ({
    id: r.id,
    label: `vs ${r.opponent}${r.competition ? ` · ${r.competition}` : ""} — ${new Date(r.date as unknown as string).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Sao_Paulo" })}`,
    types: (typesByGame[r.id] ?? []).map((t) => ({ code: t.code, name: t.name, priceCents: t.priceCents })),
  }));
}

// ─── UPSELL ACTIONS ──────────────────────────────────────────────────────────

export async function getAdminUpsellOffers(
  params: { page?: number; limit?: number } = {},
): Promise<{ rows: UpsellOfferRow[]; total: number }> {
  await requireModule("upsell");
  const db = await getDb();
  const { page = 1, limit = ADMIN_PAGE_SIZE } = params;
  const offset = (page - 1) * limit;

  const [totalRow] = await db.select({ total: count() }).from(upsellOffers);

  const raw = await db
    .select()
    .from(upsellOffers)
    .orderBy(desc(upsellOffers.createdAt))
    .limit(limit)
    .offset(offset);

  const rows = raw.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    triggerType: r.triggerType,
    triggerProductId: r.triggerProductId ?? null,
    offerType: r.offerType,
    offerProductId: r.offerProductId ?? null,
    offerTicketType: r.offerTicketType ?? null,
    offerGameId: r.offerGameId ?? null,
    offerQuantity: r.offerQuantity ?? 1,
    originalPriceCents: r.originalPriceCents,
    discountPct: r.discountPct,
    active: r.active,
    minOrderCents: r.minOrderCents,
    minQuantity: r.minQuantity ?? null,
    timerSeconds: r.timerSeconds,
    createdAt: r.createdAt,
  }));

  return { rows, total: Number(totalRow.total) };
}

export async function getAdminUpsellOfferById(
  id: string
): Promise<UpsellOfferRow | null> {
  const db = await getDb();
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
    offerGameId: r.offerGameId ?? null,
    offerQuantity: r.offerQuantity ?? 1,
    originalPriceCents: r.originalPriceCents,
    discountPct: r.discountPct,
    active: r.active,
    minOrderCents: r.minOrderCents,
    minQuantity: r.minQuantity ?? null,
    timerSeconds: r.timerSeconds,
    createdAt: r.createdAt,
  };
}

export async function createUpsellOffer(
  data: UpsellOfferInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  await requireModule("upsell");
  const db = await getDb();
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
        offerGameId: data.offerGameId ?? null,
        offerQuantity: data.offerQuantity,
        originalPriceCents: data.originalPriceCents,
        discountPct: data.discountPct,
        active: data.active,
        minOrderCents: data.minOrderCents,
        minQuantity: data.minQuantity ?? null,
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
  await requireModule("upsell");
  const db = await getDb();
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
    if (data.offerGameId !== undefined)
      updateData.offerGameId = data.offerGameId ?? null;
    if (data.offerQuantity !== undefined) updateData.offerQuantity = data.offerQuantity;
    if (data.originalPriceCents !== undefined)
      updateData.originalPriceCents = data.originalPriceCents;
    if (data.discountPct !== undefined) updateData.discountPct = data.discountPct;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.minOrderCents !== undefined)
      updateData.minOrderCents = data.minOrderCents;
    if (data.minQuantity !== undefined) updateData.minQuantity = data.minQuantity ?? null;
    if (data.timerSeconds !== undefined)
      updateData.timerSeconds = data.timerSeconds;

    if (Object.keys(updateData).length === 0) return { success: false, error: "Nenhum campo para atualizar." };
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
  await requireModule("upsell");
  const db = await getDb();
  await db
    .update(upsellOffers)
    .set({ active })
    .where(eq(upsellOffers.id, id));
  revalidatePath("/admin/upsell");
}

export async function deleteUpsellOffer(
  id: string
): Promise<{ success: boolean }> {
  await requireModule("upsell");
  const db = await getDb();
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
  description: string | null;
  priceCents: number;
  ticketDiscountPct: number;
  productDiscountPct: number;
  freeTicketsPerHomeGame: number;
  firstMonthFree: boolean;
  /** ISO (fim do dia em Brasília) ou null sem data-limite. */
  promoEndsAt: string | null;
  highlightLabel: string | null;
  cardColor: string | null;
  highlight: boolean;
  active: boolean;
  order: number;
}

/**
 * Campos enviados pelo admin. `promoEndsAt` é "AAAA-MM-DD" (input date) ou null.
 * Campos que não vierem ficam com o valor padrão (ou o atual, no update).
 */
export interface MembershipPlanInput {
  name: string;
  slug: string;
  icon?: string;
  description?: string | null;
  priceCents: number;
  ticketDiscountPct: number;
  productDiscountPct: number;
  freeTicketsPerHomeGame?: number;
  firstMonthFree?: boolean;
  promoEndsAt?: string | null;
  highlightLabel?: string | null;
  cardColor?: string | null;
  highlight: boolean;
  active: boolean;
  order?: number;
}

export interface BenefitRow {
  id: string;
  label: string;
  order: number;
}

/** Benefício de um plano, com o detalhe específico daquele plano (ex.: "3 segundos"). */
export interface PlanBenefitRow extends BenefitRow {
  detail: string | null;
}

export interface MemberRow {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  planId: string | null;
  planName: string | null;
  status: string;
  nextBillingDate: Date | null;
  /** Fim do 1º mês grátis (NULL = sem promoção). */
  trialEndsAt: Date | null;
  /** Já houve mensalidade paga (o mês grátis só conta antes disso). */
  hasPaid: boolean;
  createdAt: Date;
}

const MEMBER_STATUSES = ["pending", "active", "suspended", "cancelled"] as const;

const idSchema = z.uuid("Identificador inválido");
const benefitLabelSchema = z.string().trim().min(2, "Nome muito curto").max(80, "Nome muito longo");

/** Erro de domínio (validação/regra) pode ir ao admin; qualquer outro vira mensagem genérica. */
function planErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof PlanAdminError) return err.message;
  console.error(fallback, err);
  return fallback;
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

// ─── MEMBERSHIP PLAN ACTIONS ─────────────────────────────────────────────────

export async function getAdminMembershipPlans(): Promise<
  (MembershipPlanRow & { benefits: PlanBenefitRow[] })[]
> {
  await requireModule("socios");
  const db = await getDb();
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
      detail: planBenefits.detail,
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
    description: plan.description ?? null,
    priceCents: plan.priceCents,
    ticketDiscountPct: plan.ticketDiscountPct,
    productDiscountPct: plan.productDiscountPct,
    freeTicketsPerHomeGame: plan.freeTicketsPerHomeGame,
    firstMonthFree: plan.firstMonthFree,
    promoEndsAt: plan.promoEndsAt ? plan.promoEndsAt.toISOString() : null,
    highlightLabel: plan.highlightLabel ?? null,
    cardColor: plan.cardColor ?? null,
    highlight: plan.highlight,
    active: plan.active,
    order: plan.order,
    benefits: allPlanBenefits
      .filter((pb) => pb.planId === plan.id)
      .map((pb) => ({
        id: pb.benefitId,
        label: pb.label,
        order: pb.order,
        detail: pb.detail ?? null,
      })),
  }));
}

/** Valores padrão de quem não envia os campos novos (ex.: agente). */
function withPlanDefaults(data: MembershipPlanInput) {
  return {
    ...data,
    icon: data.icon || "Star",
    freeTicketsPerHomeGame: data.freeTicketsPerHomeGame ?? 0,
    firstMonthFree: data.firstMonthFree ?? false,
    order: data.order ?? 0,
  };
}

export async function createMembershipPlan(
  data: MembershipPlanInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  await requireModule("socios");
  const parsed = planFieldsSchema.safeParse(withPlanDefaults(data));
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
  try {
    const db = await getDb();
    const { id } = await savePlan(db, null, parsed.data);
    revalidatePath("/admin/socios");
    return { success: true, id };
  } catch (err) {
    return { success: false, error: planErrorMessage(err, "Erro ao criar plano") };
  }
}

/** Atualização parcial: só grava o que vier. Usada pelo agente do admin. */
export async function updateMembershipPlan(
  id: string,
  data: Partial<MembershipPlanInput>
): Promise<{ success: boolean; error?: string }> {
  await requireModule("socios");
  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return { success: false, error: "Plano inválido." };
  const parsed = planPatchSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
  if (Object.values(parsed.data).every((v) => v === undefined)) {
    return { success: false, error: "Nenhum campo para atualizar." };
  }
  try {
    const db = await getDb();
    await patchPlan(db, idParsed.data, parsed.data);
    revalidatePath("/admin/socios");
    revalidatePath(`/admin/socios/planos/${idParsed.data}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: planErrorMessage(err, "Erro ao atualizar plano") };
  }
}

/**
 * Salva o formulário do plano e a lista dos seus benefícios NUMA operação atômica
 * (um batch). planId null = criação.
 */
export async function saveMembershipPlan(
  planId: string | null,
  data: MembershipPlanInput,
  benefits: { benefitId: string; detail?: string | null }[]
): Promise<{ success: boolean; id?: string; error?: string }> {
  await requireModule("socios");
  if (planId !== null && !idSchema.safeParse(planId).success) {
    return { success: false, error: "Plano inválido." };
  }
  const fields = planFieldsSchema.safeParse(withPlanDefaults(data));
  if (!fields.success) return { success: false, error: firstIssue(fields.error) };
  const links = planBenefitLinksSchema.safeParse(benefits);
  if (!links.success) return { success: false, error: firstIssue(links.error) };
  try {
    const db = await getDb();
    const { id } = await savePlan(db, planId, fields.data, links.data);
    revalidatePath("/admin/socios");
    revalidatePath(`/admin/socios/planos/${id}`);
    return { success: true, id };
  } catch (err) {
    return { success: false, error: planErrorMessage(err, "Erro ao salvar plano") };
  }
}

/** Remove o padrão do clube se ele apontar para este plano (plano desativado ou excluído). */
async function clearDefaultPlanIfIs(db: Awaited<ReturnType<typeof getDb>>, planId: string): Promise<void> {
  await db
    .delete(siteConfig)
    .where(and(eq(siteConfig.key, MEMBERSHIP_DEFAULT_PLAN_KEY), eq(siteConfig.value, planId)));
  revalidateTag(`tenant:${await currentTenantSlug()}`, { expire: 0 });
}

export async function toggleMembershipPlanActive(
  id: string,
  active: boolean
): Promise<void> {
  await requireModule("socios");
  const planId = idSchema.parse(id);
  const isActive = z.boolean().parse(active);
  const db = await getDb();
  await db
    .update(membershipPlans)
    .set({ active: isActive })
    .where(eq(membershipPlans.id, planId));
  if (!isActive) {
    await clearDefaultPlanIfIs(db, planId);
    revalidatePath("/socios/adesao");
  }
  revalidatePath("/admin/socios");
}

export async function deleteMembershipPlan(
  id: string
): Promise<{ success: boolean }> {
  await requireModule("socios");
  const planId = idSchema.parse(id);
  const db = await getDb();
  await db.delete(membershipPlans).where(eq(membershipPlans.id, planId));
  await clearDefaultPlanIfIs(db, planId);
  revalidatePath("/admin/socios");
  revalidatePath("/socios/adesao");
  return { success: true };
}

/** null = sem plano padrão (remove a chave). Aceita só uuid ou null. */
const defaultPlanIdSchema = z.union([idSchema, z.null()]);

/**
 * Define (ou remove, com null) o plano PADRÃO do clube: o que a adesão abre sem ?plano.
 * Só plano ATIVO. Guarda do módulo socios (mesma permissão de editar planos). Grava só a
 * chave membershipDefaultPlanId, fora do updateConfigValues genérico (que recusa a chave).
 * Auditado com o id do plano (sem dados pessoais).
 */
export async function setDefaultMembershipPlan(
  planId: string | null
): Promise<{ success: boolean; error?: string }> {
  await requireModule("socios");
  const parsed = defaultPlanIdSchema.safeParse(planId);
  if (!parsed.success) return { success: false, error: "Plano inválido." };
  const target = parsed.data;

  try {
    const db = await getDb();
    if (target === null) {
      await db.delete(siteConfig).where(eq(siteConfig.key, MEMBERSHIP_DEFAULT_PLAN_KEY));
    } else {
      const [plan] = await db
        .select({ id: membershipPlans.id, active: membershipPlans.active })
        .from(membershipPlans)
        .where(eq(membershipPlans.id, target))
        .limit(1);
      if (!plan) return { success: false, error: "Plano não encontrado." };
      if (!plan.active) {
        return { success: false, error: "Ative o plano antes de defini-lo como padrão." };
      }
      await db
        .insert(siteConfig)
        .values({ key: MEMBERSHIP_DEFAULT_PLAN_KEY, value: plan.id, type: "string", updatedAt: new Date() })
        .onConflictDoUpdate({
          target: siteConfig.key,
          set: { value: plan.id, type: "string", updatedAt: new Date() },
        });
    }
  } catch (err) {
    return { success: false, error: planErrorMessage(err, "Erro ao definir o plano padrão") };
  }

  await logAudit("membership_default_plan", "site_config", null, {
    key: MEMBERSHIP_DEFAULT_PLAN_KEY,
    planId: target,
  });
  // Mesmo efeito do updateConfigValues: a adesão e o site leem a config nova na hora.
  revalidateTag(`tenant:${await currentTenantSlug()}`, { expire: 0 });
  revalidatePath("/admin/socios");
  revalidatePath("/socios/adesao");
  revalidatePath("/");
  return { success: true };
}

// ─── BENEFIT ACTIONS ─────────────────────────────────────────────────────────

export async function getAdminBenefits(): Promise<BenefitRow[]> {
  await requireModule("socios");
  const db = await getDb();
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
  await requireModule("socios");
  const parsed = benefitLabelSchema.safeParse(label);
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
  const db = await getDb();
  try {
    // Novo benefício entra no fim da lista (não na posição 0).
    const [last] = await db
      .select({ max: sql<number>`coalesce(max(${membershipBenefits.order}), -1)` })
      .from(membershipBenefits);
    const [benefit] = await db
      .insert(membershipBenefits)
      .values({ label: parsed.data, order: Number(last?.max ?? -1) + 1 })
      .returning({ id: membershipBenefits.id });

    revalidatePath("/admin/socios");
    return { success: true, id: benefit.id };
  } catch (err) {
    console.error("createBenefit error:", err);
    return { success: false, error: "Erro ao criar benefício" };
  }
}

export async function renameBenefit(
  id: string,
  label: string
): Promise<{ success: boolean; error?: string }> {
  await requireModule("socios");
  const benefitId = idSchema.safeParse(id);
  if (!benefitId.success) return { success: false, error: "Benefício inválido." };
  const parsed = benefitLabelSchema.safeParse(label);
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
  const db = await getDb();
  await db
    .update(membershipBenefits)
    .set({ label: parsed.data })
    .where(eq(membershipBenefits.id, benefitId.data));
  revalidatePath("/admin/socios");
  revalidatePath("/admin/socios/beneficios");
  return { success: true };
}

export async function deleteBenefit(
  id: string
): Promise<{ success: boolean }> {
  await requireModule("socios");
  const benefitId = idSchema.parse(id);
  const db = await getDb();
  await db.delete(membershipBenefits).where(eq(membershipBenefits.id, benefitId));
  revalidatePath("/admin/socios");
  return { success: true };
}

export async function moveBenefitUp(id: string): Promise<void> {
  await requireModule("socios");
  const benefitId = idSchema.parse(id);
  const db = await getDb();
  const [current] = await db
    .select({ id: membershipBenefits.id, order: membershipBenefits.order })
    .from(membershipBenefits)
    .where(eq(membershipBenefits.id, benefitId))
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
  revalidatePath("/admin/socios/beneficios");
}

export async function moveBenefitDown(id: string): Promise<void> {
  await requireModule("socios");
  const benefitId = idSchema.parse(id);
  const db = await getDb();
  const [current] = await db
    .select({ id: membershipBenefits.id, order: membershipBenefits.order })
    .from(membershipBenefits)
    .where(eq(membershipBenefits.id, benefitId))
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
  revalidatePath("/admin/socios/beneficios");
}

/** Troca os benefícios de um plano (com detalhe), atomicamente. */
export async function setPlanBenefits(
  planId: string,
  benefits: { benefitId: string; detail?: string | null }[]
): Promise<{ success: boolean; error?: string }> {
  await requireModule("socios");
  const id = idSchema.safeParse(planId);
  if (!id.success) return { success: false, error: "Plano inválido." };
  const links = planBenefitLinksSchema.safeParse(benefits);
  if (!links.success) return { success: false, error: firstIssue(links.error) };
  try {
    const db = await getDb();
    await replacePlanBenefits(db, id.data, links.data);
    revalidatePath("/admin/socios");
    revalidatePath(`/admin/socios/planos/${id.data}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: planErrorMessage(err, "Erro ao salvar benefícios") };
  }
}

/** Grava a matriz inteira (planos × benefícios) da tela de benefícios, atomicamente. */
export async function saveBenefitMatrix(
  input: BenefitMatrixInput
): Promise<{ success: boolean; error?: string }> {
  await requireModule("socios");
  const parsed = benefitMatrixSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
  try {
    const db = await getDb();
    await saveBenefitMatrixRows(db, parsed.data);
    revalidatePath("/admin/socios");
    revalidatePath("/admin/socios/beneficios");
    return { success: true };
  } catch (err) {
    return { success: false, error: planErrorMessage(err, "Erro ao salvar a matriz de benefícios") };
  }
}

// ─── MEMBER ACTIONS ──────────────────────────────────────────────────────────

export async function getAdminMembers(params: {
  page: number;
  status?: string;
  planId?: string;
  search?: string;
  limit?: number;
}): Promise<{ rows: MemberRow[]; total: number }> {
  await requireModule("socios");
  const db = await getDb();
  const { page, status, planId, search, limit = 20 } = params;
  const offset = (page - 1) * limit;

  const conditions = [];

  // Filtro validado contra os status conhecidos (o valor vem da query string).
  const statusFilter = MEMBER_STATUSES.find((s) => s === status);
  if (statusFilter) {
    conditions.push(eq(members.status, statusFilter));
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
      nextBillingDate: members.nextBillingDate,
      trialEndsAt: members.trialEndsAt,
      hasPaid: members.hasPaid,
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
      nextBillingDate: r.nextBillingDate ?? null,
      trialEndsAt: r.trialEndsAt ?? null,
      hasPaid: r.hasPaid,
      createdAt: r.createdAt,
    })),
    total: Number(totalRow.total),
  };
}

export async function updateMemberStatus(
  id: string,
  status: "pending" | "active" | "cancelled"
): Promise<void> {
  await requireModule("socios");
  const db = await getDb();
  await db.update(members).set({ status }).where(eq(members.id, id));
  revalidatePath("/admin/socios");
}

export async function exportMembersCSV(status?: string): Promise<string> {
  await requireModule("socios");
  const db = await getDb();
  const conditions = [];
  if (status && status !== "all") {
    conditions.push(eq(members.status, status as "pending" | "active" | "cancelled"));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      name: members.name,
      email: members.email,
      whatsapp: members.whatsapp,
      status: members.status,
      planName: membershipPlans.name,
      createdAt: members.createdAt,
    })
    .from(members)
    .leftJoin(membershipPlans, eq(members.planId, membershipPlans.id))
    .where(whereClause)
    .orderBy(desc(members.createdAt));

  // toCsv neutraliza células que começam com = + - @ (injeção de fórmula no Excel).
  return toCsv([
    ["Nome", "Email", "WhatsApp", "Status", "Plano", "Data"],
    ...rows.map((r) => [
      r.name,
      r.email,
      r.whatsapp,
      r.status,
      r.planName,
      r.createdAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    ]),
  ]);
}
