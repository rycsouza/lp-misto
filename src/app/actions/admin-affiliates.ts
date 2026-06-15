"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { affiliates, affiliateReferrals } from "@/lib/db/schema";
import { eq, desc, sum, count, and } from "drizzle-orm";
import { generateAffiliateCode, isValidAffiliateCode } from "@/lib/affiliates/utils";

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

export async function getAdminAffiliates(): Promise<AffiliateRow[]> {
  const rows = await db.select().from(affiliates).orderBy(desc(affiliates.createdAt));

  const stats = await db
    .select({
      affiliateId: affiliateReferrals.affiliateId,
      status: affiliateReferrals.status,
      total: count(),
      commissionSum: sum(affiliateReferrals.commissionCents),
    })
    .from(affiliateReferrals)
    .groupBy(affiliateReferrals.affiliateId, affiliateReferrals.status);

  return rows.map((r) => {
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
}

export async function getAdminAffiliate(id: string): Promise<AffiliateRow | null> {
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
  await db.delete(affiliates).where(eq(affiliates.id, id));
  revalidatePath("/admin/afiliados");
  return { success: true };
}

export async function markReferralsPaid(
  referralIds: string[]
): Promise<{ success: boolean }> {
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
