"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { affiliates, affiliateReferrals, affiliateWithdrawals, coupons } from "@/lib/db/schema";
import { eq, desc, sum, count, and, isNull, isNotNull, inArray } from "drizzle-orm";
import { generateAffiliateCode, isValidAffiliateCode } from "@/lib/affiliates/utils";
import { requireModule } from "@/lib/admin/auth-guard";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/pagination";

export interface AffiliateRow {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  code: string;
  commissionType: "pct" | "fixed";
  commissionValue: number;
  active: boolean;
  createdAt: Date;
  // stats
  totalReferrals: number;
  pendingCommissionCents: number;
  paidCommissionCents: number;
}

export interface AffiliateInput {
  name: string;
  email: string;
  whatsapp: string | null;
  code: string;
  commissionType: "pct" | "fixed";
  commissionValue: number;
  active: boolean;
}

export interface ReferralRow {
  id: string;
  affiliateId: string;
  affiliateName: string;
  affiliateCode: string;
  orderId: string;
  commissionCents: number;
  status: "pending" | "paid" | "cancelled";
  paidAt: Date | null;
  createdAt: Date;
}

export async function getAdminAffiliates(
  params: { page?: number; limit?: number } = {}
): Promise<{ rows: AffiliateRow[]; total: number }> {
  // Server action = endpoint POST público; expõe PII + chave PIX → exige autorização.
  await requireModule("cupons");
  const db = await getDb();
  const { page = 1, limit = ADMIN_PAGE_SIZE } = params;
  const offset = (page - 1) * limit;

  const [totalRow] = await db.select({ total: count() }).from(affiliates);

  const rows = await db
    .select()
    .from(affiliates)
    .orderBy(desc(affiliates.createdAt))
    .limit(limit)
    .offset(offset);

  const pageIds = rows.map((r) => r.id);
  const stats = pageIds.length
    ? await db
        .select({
          affiliateId: affiliateReferrals.affiliateId,
          status: affiliateReferrals.status,
          total: count(),
          commissionSum: sum(affiliateReferrals.commissionCents),
        })
        .from(affiliateReferrals)
        .where(inArray(affiliateReferrals.affiliateId, pageIds))
        .groupBy(affiliateReferrals.affiliateId, affiliateReferrals.status)
    : [];

  const mapped = rows.map((r) => {
    const myStats = stats.filter((s) => s.affiliateId === r.id);
    const pendingRow = myStats.find((s) => s.status === "pending");
    const paidRow = myStats.find((s) => s.status === "paid");
    const totalReferrals = myStats.reduce((acc, s) => acc + Number(s.total), 0);

    return {
      id: r.id,
      name: r.name,
      email: r.email,
      whatsapp: r.whatsapp,
      code: r.code,
      commissionType: r.commissionType as "pct" | "fixed",
      commissionValue: r.commissionValue,
      active: r.active,
      createdAt: r.createdAt,
      totalReferrals,
      pendingCommissionCents: Number(pendingRow?.commissionSum ?? 0),
      paidCommissionCents: Number(paidRow?.commissionSum ?? 0),
    };
  });

  return { rows: mapped, total: Number(totalRow.total) };
}

export async function getAdminAffiliate(id: string): Promise<AffiliateRow | null> {
  const db = await getDb();
  const rows = await db.select().from(affiliates).where(eq(affiliates.id, id)).limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    whatsapp: r.whatsapp,
    code: r.code,
    commissionType: r.commissionType as "pct" | "fixed",
    commissionValue: r.commissionValue,
    active: r.active,
    createdAt: r.createdAt,
    totalReferrals: 0,
    pendingCommissionCents: 0,
    paidCommissionCents: 0,
  };
}

export async function getAffiliateReferrals(affiliateId?: string): Promise<ReferralRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: affiliateReferrals.id,
      affiliateId: affiliateReferrals.affiliateId,
      affiliateName: affiliates.name,
      affiliateCode: affiliates.code,
      orderId: affiliateReferrals.orderId,
      commissionCents: affiliateReferrals.commissionCents,
      status: affiliateReferrals.status,
      paidAt: affiliateReferrals.paidAt,
      createdAt: affiliateReferrals.createdAt,
    })
    .from(affiliateReferrals)
    .innerJoin(affiliates, eq(affiliateReferrals.affiliateId, affiliates.id))
    .where(affiliateId ? eq(affiliateReferrals.affiliateId, affiliateId) : undefined)
    .orderBy(desc(affiliateReferrals.createdAt));

  return rows.map((r) => ({
    id: r.id,
    affiliateId: r.affiliateId,
    affiliateName: r.affiliateName,
    affiliateCode: r.affiliateCode,
    orderId: r.orderId,
    commissionCents: r.commissionCents,
    status: r.status as "pending" | "paid" | "cancelled",
    paidAt: r.paidAt,
    createdAt: r.createdAt,
  }));
}

export async function createAffiliate(
  input: AffiliateInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  await requireModule("cupons");
  const db = await getDb();
  if (!input.name.trim()) return { success: false, error: "Nome obrigatório." };
  if (!input.email.includes("@")) return { success: false, error: "E-mail inválido." };
  if (!isValidAffiliateCode(input.code)) {
    return { success: false, error: "Código inválido. Use 4–20 caracteres alfanuméricos." };
  }

  const code = input.code.toUpperCase();
  const [existing] = await db
    .select({ id: affiliates.id })
    .from(affiliates)
    .where(eq(affiliates.code, code))
    .limit(1);
  if (existing) return { success: false, error: "Este código já está em uso." };

  const [row] = await db
    .insert(affiliates)
    .values({
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      whatsapp: input.whatsapp?.replace(/\D/g, "") || null,
      code,
      commissionType: input.commissionType,
      commissionValue: input.commissionValue,
      active: input.active,
    })
    .returning({ id: affiliates.id });

  revalidatePath("/admin/afiliados");
  return { success: true, id: row.id };
}

export async function updateAffiliate(
  id: string,
  input: AffiliateInput
): Promise<{ success: boolean; error?: string }> {
  await requireModule("cupons");
  const db = await getDb();
  if (!input.name.trim()) return { success: false, error: "Nome obrigatório." };
  if (!isValidAffiliateCode(input.code)) {
    return { success: false, error: "Código inválido. Use 4–20 caracteres alfanuméricos." };
  }

  const code = input.code.toUpperCase();
  const [existing] = await db
    .select({ id: affiliates.id })
    .from(affiliates)
    .where(eq(affiliates.code, code))
    .limit(1);
  if (existing && existing.id !== id) return { success: false, error: "Este código já está em uso." };

  await db.update(affiliates).set({
    name: input.name.trim(),
    email: input.email.toLowerCase().trim(),
    whatsapp: input.whatsapp?.replace(/\D/g, "") || null,
    code,
    commissionType: input.commissionType,
    commissionValue: input.commissionValue,
    active: input.active,
  }).where(eq(affiliates.id, id));

  revalidatePath("/admin/afiliados");
  return { success: true };
}

export async function deleteAffiliate(
  id: string
): Promise<{ success: boolean }> {
  await requireModule("cupons");
  const db = await getDb();
  await db.delete(affiliates).where(eq(affiliates.id, id));
  revalidatePath("/admin/afiliados");
  return { success: true };
}

export async function markReferralsPaid(
  referralIds: string[]
): Promise<{ success: boolean }> {
  await requireModule("cupons");
  const db = await getDb();
  if (referralIds.length === 0) return { success: true };
  for (const rid of referralIds) {
    await db
      .update(affiliateReferrals)
      .set({ status: "paid", paidAt: new Date() })
      .where(and(eq(affiliateReferrals.id, rid), eq(affiliateReferrals.status, "pending")));
  }
  revalidatePath("/admin/afiliados");
  return { success: true };
}

export async function suggestAffiliateCode(name: string): Promise<string> {
  return generateAffiliateCode(name).toUpperCase();
}

// ─── Withdrawals ─────────────────────────────────────────────────────────────

export interface WithdrawalRow {
  id: string;
  affiliateId: string;
  affiliateName: string;
  affiliateCode: string;
  amountCents: number;
  pixKey: string;
  pixKeyType: string;
  status: "requested" | "processing" | "paid" | "rejected";
  rejectionReason: string | null;
  requestedAt: Date;
  processedAt: Date | null;
}

export async function getWithdrawals(
  params: { page?: number; limit?: number } = {}
): Promise<{ rows: WithdrawalRow[]; total: number }> {
  // Expõe dados financeiros/PIX de saques → exige autorização (endpoint POST público).
  await requireModule("cupons");
  const db = await getDb();
  const { page = 1, limit = ADMIN_PAGE_SIZE } = params;
  const offset = (page - 1) * limit;

  const [totalRow] = await db
    .select({ total: count() })
    .from(affiliateWithdrawals)
    .innerJoin(affiliates, eq(affiliateWithdrawals.affiliateId, affiliates.id));

  const rows = await db
    .select({
      id: affiliateWithdrawals.id,
      affiliateId: affiliateWithdrawals.affiliateId,
      affiliateName: affiliates.name,
      affiliateCode: affiliates.code,
      amountCents: affiliateWithdrawals.amountCents,
      pixKey: affiliateWithdrawals.pixKey,
      pixKeyType: affiliateWithdrawals.pixKeyType,
      status: affiliateWithdrawals.status,
      rejectionReason: affiliateWithdrawals.rejectionReason,
      requestedAt: affiliateWithdrawals.requestedAt,
      processedAt: affiliateWithdrawals.processedAt,
    })
    .from(affiliateWithdrawals)
    .innerJoin(affiliates, eq(affiliateWithdrawals.affiliateId, affiliates.id))
    .orderBy(desc(affiliateWithdrawals.requestedAt))
    .limit(limit)
    .offset(offset);

  return {
    rows: rows.map((r) => ({
      ...r,
      status: r.status as "requested" | "processing" | "paid" | "rejected",
    })),
    total: Number(totalRow.total),
  };
}

export async function markWithdrawalPaid(
  withdrawalId: string
): Promise<{ success: boolean }> {
  await requireModule("cupons");
  const db = await getDb();
  const [withdrawal] = await db
    .select()
    .from(affiliateWithdrawals)
    .where(eq(affiliateWithdrawals.id, withdrawalId))
    .limit(1);

  if (!withdrawal) return { success: false };

  await db
    .update(affiliateWithdrawals)
    .set({ status: "paid", processedAt: new Date() })
    .where(eq(affiliateWithdrawals.id, withdrawalId));

  // Mark eligible pending referrals as paid
  await db
    .update(affiliateReferrals)
    .set({ status: "paid", paidAt: new Date() })
    .where(
      and(
        eq(affiliateReferrals.affiliateId, withdrawal.affiliateId),
        eq(affiliateReferrals.status, "pending")
      )
    );

  revalidatePath("/admin/afiliados/saques");
  return { success: true };
}

export async function rejectWithdrawal(
  withdrawalId: string,
  reason: string
): Promise<{ success: boolean }> {
  await requireModule("cupons");
  const db = await getDb();
  await db
    .update(affiliateWithdrawals)
    .set({ status: "rejected", rejectionReason: reason, processedAt: new Date() })
    .where(eq(affiliateWithdrawals.id, withdrawalId));

  revalidatePath("/admin/afiliados/saques");
  return { success: true };
}

// ─── Coupon linking ───────────────────────────────────────────────────────────

export async function linkCouponToAffiliate(
  affiliateId: string,
  couponId: string | null
): Promise<{ success: boolean; error?: string }> {
  await requireModule("cupons");
  const db = await getDb();
  // First unlink any coupon already pointing to this affiliate
  await db
    .update(coupons)
    .set({ affiliateId: null })
    .where(eq(coupons.affiliateId, affiliateId));

  if (couponId) {
    await db
      .update(coupons)
      .set({ affiliateId })
      .where(eq(coupons.id, couponId));
  }

  revalidatePath(`/admin/afiliados/${affiliateId}`);
  return { success: true };
}

export async function getActiveCoupons() {
  const db = await getDb();
  return db
    .select({ id: coupons.id, code: coupons.code, description: coupons.description, affiliateId: coupons.affiliateId })
    .from(coupons)
    .where(eq(coupons.active, true))
    .orderBy(coupons.code);
}
