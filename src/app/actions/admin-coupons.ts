"use server";

import { getDb } from "@/lib/db/client";
import { coupons, couponUsages } from "@/lib/db/schema";
import { eq, desc, sql, count } from "drizzle-orm";
import type { Coupon } from "@/lib/db/schema";
import { requireModule } from "@/lib/admin/auth-guard";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/pagination";

export interface CouponRow {
  id: string;
  code: string;
  description: string | null;
  discountType: "pct" | "fixed";
  discountValue: number;
  appliesTo: "order" | "tickets" | "products";
  minOrderCents: number;
  maxUsages: number | null;
  maxUsagesPerCustomer: number | null;
  usageCount: number;
  expiresAt: string | null;
  active: boolean;
}

export interface CouponInput {
  code: string;
  description?: string | null;
  discountType: "pct" | "fixed";
  discountValue: number;
  appliesTo: "order" | "tickets" | "products";
  minOrderCents: number;
  maxUsages?: number | null;
  maxUsagesPerCustomer?: number | null;
  expiresAt?: string | null;
  active: boolean;
}

function toRow(c: Coupon): CouponRow {
  return {
    id: c.id,
    code: c.code,
    description: c.description ?? null,
    discountType: c.discountType as "pct" | "fixed",
    discountValue: c.discountValue,
    appliesTo: c.appliesTo as "order" | "tickets" | "products",
    minOrderCents: c.minOrderCents,
    maxUsages: c.maxUsages ?? null,
    maxUsagesPerCustomer: c.maxUsagesPerCustomer ?? null,
    usageCount: c.usageCount,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    active: c.active,
  };
}

export async function getAdminCoupons(
  params: { page?: number; limit?: number } = {}
): Promise<{ rows: CouponRow[]; total: number }> {
  const db = await getDb();
  const { page = 1, limit = ADMIN_PAGE_SIZE } = params;
  const offset = (page - 1) * limit;
  const [totalRow] = await db.select({ total: count() }).from(coupons);
  const rows = await db
    .select()
    .from(coupons)
    .orderBy(desc(coupons.createdAt))
    .limit(limit)
    .offset(offset);
  return { rows: rows.map(toRow), total: Number(totalRow.total) };
}

export async function getAdminCouponById(id: string): Promise<CouponRow | null> {
  const db = await getDb();
  const [row] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
  return row ? toRow(row) : null;
}

export async function createCoupon(
  data: CouponInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  await requireModule("cupons");
  const db = await getDb();
  try {
    const [row] = await db
      .insert(coupons)
      .values({
        code: data.code.trim().toUpperCase(),
        description: data.description ?? null,
        discountType: data.discountType,
        discountValue: data.discountValue,
        appliesTo: data.appliesTo,
        minOrderCents: data.minOrderCents,
        maxUsages: data.maxUsages ?? null,
        maxUsagesPerCustomer: data.maxUsagesPerCustomer ?? null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        active: data.active,
      })
      .returning({ id: coupons.id });
    return { success: true, id: row.id };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique")) {
      return { success: false, error: "Este código já está em uso" };
    }
    return { success: false, error: "Erro ao criar cupom" };
  }
}

export async function updateCoupon(
  id: string,
  data: CouponInput
): Promise<{ success: boolean; error?: string }> {
  await requireModule("cupons");
  const db = await getDb();
  try {
    await db
      .update(coupons)
      .set({
        code: data.code.trim().toUpperCase(),
        description: data.description ?? null,
        discountType: data.discountType,
        discountValue: data.discountValue,
        appliesTo: data.appliesTo,
        minOrderCents: data.minOrderCents,
        maxUsages: data.maxUsages ?? null,
        maxUsagesPerCustomer: data.maxUsagesPerCustomer ?? null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        active: data.active,
      })
      .where(eq(coupons.id, id));
    return { success: true };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique")) {
      return { success: false, error: "Este código já está em uso" };
    }
    return { success: false, error: "Erro ao atualizar cupom" };
  }
}

export async function deleteCoupon(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requireModule("cupons");
  const db = await getDb();
  try {
    await db.delete(couponUsages).where(eq(couponUsages.couponId, id));
    await db.delete(coupons).where(eq(coupons.id, id));
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao excluir cupom" };
  }
}

export interface CouponUsageDetail {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string | null;
  customerWhatsapp: string | null;
  discountAppliedCents: number;
  createdAt: string;
}

export async function getCouponUsages(couponId: string): Promise<CouponUsageDetail[]> {
  const db = await getDb();
  const { customers } = await import("@/lib/db/schema");
  const rows = await db
    .select({
      id: couponUsages.id,
      orderId: couponUsages.orderId,
      customerId: couponUsages.customerId,
      customerName: customers.name,
      customerWhatsapp: customers.whatsapp,
      discountAppliedCents: couponUsages.discountAppliedCents,
      createdAt: couponUsages.createdAt,
    })
    .from(couponUsages)
    .leftJoin(customers, eq(couponUsages.customerId, customers.id))
    .where(eq(couponUsages.couponId, couponId))
    .orderBy(desc(couponUsages.createdAt));
  return rows.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    customerId: r.customerId,
    customerName: r.customerName ?? null,
    customerWhatsapp: r.customerWhatsapp ?? null,
    discountAppliedCents: r.discountAppliedCents,
    createdAt: r.createdAt.toISOString(),
  }));
}
