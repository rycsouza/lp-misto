"use server";

import { db } from "@/lib/db/client";
import {
  affiliates,
  affiliateReferrals,
  affiliateWithdrawals,
  leads,
  members,
  coupons,
} from "@/lib/db/schema";
import { eq, count, sum, and, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface AffiliatePortalData {
  totalReferrals: number;
  pendingCommissionCents: number;
  totalLeads: number;
  totalMembers: number;
  coupon: {
    id: string;
    code: string;
    discountType: "pct" | "fixed";
    discountValue: number;
    expiresAt: Date | null;
    usageCount: number;
    maxUsages: number | null;
  } | null;
  withdrawals: {
    id: string;
    amountCents: number;
    pixKey: string;
    pixKeyType: string;
    status: string;
    rejectionReason: string | null;
    requestedAt: Date;
    processedAt: Date | null;
  }[];
  eligibleWithdrawalCents: number;
}

export async function getAffiliatePortalData(
  affiliateId: string,
  affiliateCode: string
): Promise<AffiliatePortalData> {
  // Referrals stats
  const referralStats = await db
    .select({
      status: affiliateReferrals.status,
      total: count(),
      commissionSum: sum(affiliateReferrals.commissionCents),
    })
    .from(affiliateReferrals)
    .where(eq(affiliateReferrals.affiliateId, affiliateId))
    .groupBy(affiliateReferrals.status);

  const totalReferrals = referralStats.reduce((acc, s) => acc + Number(s.total), 0);
  const pendingRow = referralStats.find((s) => s.status === "pending");
  const pendingCommissionCents = Number(pendingRow?.commissionSum ?? 0);

  // Leads count
  const [leadsResult] = await db
    .select({ total: count() })
    .from(leads)
    .where(eq(leads.affiliateCode, affiliateCode));
  const totalLeads = Number(leadsResult?.total ?? 0);

  // Members count
  const [membersResult] = await db
    .select({ total: count() })
    .from(members)
    .where(eq(members.affiliateCode, affiliateCode));
  const totalMembers = Number(membersResult?.total ?? 0);

  // Linked coupon
  const [couponRow] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.affiliateId, affiliateId))
    .limit(1);

  const coupon = couponRow
    ? {
        id: couponRow.id,
        code: couponRow.code,
        discountType: couponRow.discountType as "pct" | "fixed",
        discountValue: couponRow.discountValue,
        expiresAt: couponRow.expiresAt,
        usageCount: couponRow.usageCount,
        maxUsages: couponRow.maxUsages,
      }
    : null;

  // Withdrawals list
  const withdrawalRows = await db
    .select()
    .from(affiliateWithdrawals)
    .where(eq(affiliateWithdrawals.affiliateId, affiliateId))
    .orderBy(sql`${affiliateWithdrawals.requestedAt} DESC`);

  // Eligible for withdrawal: pending referrals older than 3 days
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const [eligibleResult] = await db
    .select({ total: sum(affiliateReferrals.commissionCents) })
    .from(affiliateReferrals)
    .where(
      and(
        eq(affiliateReferrals.affiliateId, affiliateId),
        eq(affiliateReferrals.status, "pending"),
        lt(affiliateReferrals.createdAt, threeDaysAgo)
      )
    );
  const eligibleWithdrawalCents = Number(eligibleResult?.total ?? 0);

  return {
    totalReferrals,
    pendingCommissionCents,
    totalLeads,
    totalMembers,
    coupon,
    withdrawals: withdrawalRows.map((w) => ({
      id: w.id,
      amountCents: w.amountCents,
      pixKey: w.pixKey,
      pixKeyType: w.pixKeyType,
      status: w.status,
      rejectionReason: w.rejectionReason,
      requestedAt: w.requestedAt,
      processedAt: w.processedAt,
    })),
    eligibleWithdrawalCents,
  };
}

export async function requestWithdrawal(
  affiliateId: string,
  pixKey: string,
  pixKeyType: string
): Promise<{ success: boolean; error?: string }> {
  const validPixKeyTypes = ["cpf", "cnpj", "email", "phone", "random"] as const;
  if (!validPixKeyTypes.includes(pixKeyType as (typeof validPixKeyTypes)[number])) {
    return { success: false, error: "Tipo de chave PIX inválido." };
  }
  if (!pixKey.trim()) {
    return { success: false, error: "Chave PIX obrigatória." };
  }

  // Compute eligible amount
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const [eligibleResult] = await db
    .select({ total: sum(affiliateReferrals.commissionCents) })
    .from(affiliateReferrals)
    .where(
      and(
        eq(affiliateReferrals.affiliateId, affiliateId),
        eq(affiliateReferrals.status, "pending"),
        lt(affiliateReferrals.createdAt, threeDaysAgo)
      )
    );

  const amountCents = Number(eligibleResult?.total ?? 0);
  if (amountCents <= 0) {
    return { success: false, error: "Nenhuma comissão elegível para saque ainda." };
  }

  await db.insert(affiliateWithdrawals).values({
    affiliateId,
    amountCents,
    pixKey: pixKey.trim(),
    pixKeyType: pixKeyType as "cpf" | "cnpj" | "email" | "phone" | "random",
    status: "requested",
  });

  const [affiliate] = await db
    .select({ code: affiliates.code })
    .from(affiliates)
    .where(eq(affiliates.id, affiliateId))
    .limit(1);

  if (affiliate) {
    revalidatePath(`/afiliados/${affiliate.code}`);
  }

  return { success: true };
}
