"use server";

import { getDb } from "@/lib/db/client";
import { promotions } from "@/lib/db/schema";
import { and, eq, lte, gte, or, desc } from "drizzle-orm";
import { computePromotionDiscount } from "@/lib/promotions/utils";

export interface ActivePromotion {
  id: string;
  name: string;
  discountType: "pct" | "fixed";
  discountValue: number;
  discountCents: number;
  flashSale: boolean;
  endsAt: Date;
}

export async function getActivePromotion(
  appliesTo: "tickets" | "products",
  subtotalCents: number
): Promise<ActivePromotion | null> {
  const db = await getDb();
  const now = new Date();
  const rows = await db
    .select()
    .from(promotions)
    .where(
      and(
        eq(promotions.active, true),
        lte(promotions.startsAt, now),
        gte(promotions.endsAt, now),
        or(eq(promotions.appliesTo, "all"), eq(promotions.appliesTo, appliesTo)),
        lte(promotions.minOrderCents, subtotalCents)
      )
    )
    .orderBy(desc(promotions.discountValue))
    .limit(1);

  const promo = rows[0];
  if (!promo) return null;

  const discountCents = computePromotionDiscount(subtotalCents, {
    discountType: promo.discountType as "pct" | "fixed",
    discountValue: promo.discountValue,
    minOrderCents: promo.minOrderCents,
  });

  return {
    id: promo.id,
    name: promo.name,
    discountType: promo.discountType as "pct" | "fixed",
    discountValue: promo.discountValue,
    discountCents,
    flashSale: promo.flashSale,
    endsAt: promo.endsAt,
  };
}

export async function getActivePromotionMeta(
  appliesTo: "tickets" | "products"
): Promise<{ name: string; discountType: "pct" | "fixed"; discountValue: number; minOrderCents: number } | null> {
  const db = await getDb();
  const now = new Date();
  const rows = await db
    .select({
      name: promotions.name,
      discountType: promotions.discountType,
      discountValue: promotions.discountValue,
      minOrderCents: promotions.minOrderCents,
    })
    .from(promotions)
    .where(
      and(
        eq(promotions.active, true),
        lte(promotions.startsAt, now),
        gte(promotions.endsAt, now),
        or(eq(promotions.appliesTo, "all"), eq(promotions.appliesTo, appliesTo))
      )
    )
    .orderBy(desc(promotions.discountValue))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    name: row.name,
    discountType: row.discountType as "pct" | "fixed",
    discountValue: row.discountValue,
    minOrderCents: row.minOrderCents,
  };
}

export async function getActiveFlashSale(
  appliesTo: "tickets" | "products" | "all"
): Promise<{ name: string; endsAt: Date } | null> {
  const db = await getDb();
  const now = new Date();
  const rows = await db
    .select({ name: promotions.name, endsAt: promotions.endsAt })
    .from(promotions)
    .where(
      and(
        eq(promotions.active, true),
        eq(promotions.flashSale, true),
        lte(promotions.startsAt, now),
        gte(promotions.endsAt, now),
        or(
          eq(promotions.appliesTo, "all"),
          eq(promotions.appliesTo, appliesTo === "all" ? "all" : appliesTo)
        )
      )
    )
    .orderBy(promotions.endsAt)
    .limit(1);

  return rows[0] ?? null;
}
