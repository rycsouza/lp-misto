"use server";

import { db } from "@/lib/db/client";
import { affiliates, affiliateReferrals, orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { computeAffiliateCommission } from "@/lib/affiliates/utils";
import { revalidatePath } from "next/cache";

// Called at checkout time to resolve a ref code to an affiliate id
export async function resolveAffiliateCode(code: string): Promise<string | null> {
  if (!code) return null;
  const [row] = await db
    .select({ id: affiliates.id })
    .from(affiliates)
    .where(eq(affiliates.code, code.toUpperCase()))
    .limit(1);
  return row?.id ?? null;
}

// Called after order is created (inside createOrder/createProductOrder)
export async function recordAffiliateReferral(
  orderId: string,
  affiliateCode: string,
  orderTotalCents: number
): Promise<void> {
  const [affiliate] = await db
    .select()
    .from(affiliates)
    .where(eq(affiliates.code, affiliateCode.toUpperCase()))
    .limit(1);

  if (!affiliate || !affiliate.active) return;

  const commissionCents = computeAffiliateCommission(
    orderTotalCents,
    affiliate.commissionType as "pct" | "fixed",
    affiliate.commissionValue
  );

  if (commissionCents <= 0) return;

  await db.insert(affiliateReferrals).values({
    affiliateId: affiliate.id,
    orderId,
    commissionCents,
    status: "pending",
  });
}

// Called when an order is paid (in checkPaymentStatus or webhook)
export async function confirmAffiliateReferral(orderId: string): Promise<void> {
  const [order] = await db
    .select({ affiliateCode: orders.affiliateCode, totalCents: orders.totalCents })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order?.affiliateCode) return;

  // Check if already has a referral record
  const [existing] = await db
    .select({ id: affiliateReferrals.id, status: affiliateReferrals.status })
    .from(affiliateReferrals)
    .where(eq(affiliateReferrals.orderId, orderId))
    .limit(1);

  if (existing) {
    // Only update if pending
    if (existing.status === "pending") {
      await db
        .update(affiliateReferrals)
        .set({ status: "pending" }) // stays pending until manually paid
        .where(eq(affiliateReferrals.id, existing.id));
    }
    return;
  }

  // Create if not exists (handles case where referral was recorded before order paid)
  await recordAffiliateReferral(orderId, order.affiliateCode, order.totalCents);
  revalidatePath("/admin/afiliados");
}

export async function cancelAffiliateReferral(orderId: string): Promise<void> {
  await db
    .update(affiliateReferrals)
    .set({ status: "cancelled" })
    .where(eq(affiliateReferrals.orderId, orderId));
}
