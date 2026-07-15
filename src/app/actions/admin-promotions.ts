"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { promotions } from "@/lib/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { requireModule } from "@/lib/admin/auth-guard";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/pagination";

export interface PromotionRow {
  id: string;
  name: string;
  description: string | null;
  discountType: "pct" | "fixed";
  discountValue: number;
  appliesTo: "all" | "tickets" | "products";
  minOrderCents: number;
  startsAt: Date;
  endsAt: Date;
  active: boolean;
  flashSale: boolean;
  createdAt: Date;
}

export interface PromotionInput {
  name: string;
  description: string | null;
  discountType: "pct" | "fixed";
  discountValue: number;
  appliesTo: "all" | "tickets" | "products";
  minOrderCents: number;
  startsAt: Date;
  endsAt: Date;
  active: boolean;
  flashSale: boolean;
}

export async function getAdminPromotions(
  params: { page?: number; limit?: number } = {}
): Promise<{ rows: PromotionRow[]; total: number }> {
  const db = await getDb();
  const { page = 1, limit = ADMIN_PAGE_SIZE } = params;
  const offset = (page - 1) * limit;
  const [totalRow] = await db.select({ total: count() }).from(promotions);
  const rows = await db
    .select()
    .from(promotions)
    .orderBy(desc(promotions.createdAt))
    .limit(limit)
    .offset(offset);
  return {
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      discountType: r.discountType as "pct" | "fixed",
      discountValue: r.discountValue,
      appliesTo: r.appliesTo as "all" | "tickets" | "products",
      minOrderCents: r.minOrderCents,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      active: r.active,
      flashSale: r.flashSale,
      createdAt: r.createdAt,
    })),
    total: Number(totalRow.total),
  };
}

export async function getAdminPromotion(id: string): Promise<PromotionRow | null> {
  const db = await getDb();
  const [row] = await db.select().from(promotions).where(eq(promotions.id, id)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    discountType: row.discountType as "pct" | "fixed",
    discountValue: row.discountValue,
    appliesTo: row.appliesTo as "all" | "tickets" | "products",
    minOrderCents: row.minOrderCents,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    active: row.active,
    flashSale: row.flashSale,
    createdAt: row.createdAt,
  };
}

export async function createPromotion(
  input: PromotionInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  await requireModule("cupons");
  const db = await getDb();
  if (!input.name.trim()) return { success: false, error: "Nome obrigatório." };
  if (input.startsAt >= input.endsAt) return { success: false, error: "Início deve ser antes do fim." };
  if (input.discountValue <= 0) return { success: false, error: "Desconto deve ser positivo." };

  const [row] = await db
    .insert(promotions)
    .values({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      appliesTo: input.appliesTo,
      minOrderCents: input.minOrderCents,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      active: input.active,
      flashSale: input.flashSale,
    })
    .returning({ id: promotions.id });

  revalidatePath("/admin/promocoes");
  return { success: true, id: row.id };
}

export async function updatePromotion(
  id: string,
  input: PromotionInput
): Promise<{ success: boolean; error?: string }> {
  await requireModule("cupons");
  const db = await getDb();
  if (!input.name.trim()) return { success: false, error: "Nome obrigatório." };
  if (input.startsAt >= input.endsAt) return { success: false, error: "Início deve ser antes do fim." };
  if (input.discountValue <= 0) return { success: false, error: "Desconto deve ser positivo." };

  await db
    .update(promotions)
    .set({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      appliesTo: input.appliesTo,
      minOrderCents: input.minOrderCents,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      active: input.active,
      flashSale: input.flashSale,
    })
    .where(eq(promotions.id, id));

  revalidatePath("/admin/promocoes");
  return { success: true };
}

export async function deletePromotion(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requireModule("cupons");
  const db = await getDb();
  await db.delete(promotions).where(eq(promotions.id, id));
  revalidatePath("/admin/promocoes");
  return { success: true };
}

export async function togglePromotionActive(
  id: string,
  active: boolean
): Promise<{ success: boolean }> {
  await requireModule("cupons");
  const db = await getDb();
  await db.update(promotions).set({ active }).where(eq(promotions.id, id));
  revalidatePath("/admin/promocoes");
  return { success: true };
}
