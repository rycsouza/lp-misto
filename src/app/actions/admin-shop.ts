"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { products, productVariants } from "@/lib/db/schema";
import {
  eq,
  desc,
  ilike,
  and,
  or,
  sql,
  count,
  inArray,
} from "drizzle-orm";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ColorVariant {
  color: string | null;
  colorImageUrl: string | null;
}

export interface ProductRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  priceCents: number;
  imageUrl: string | null;
  active: boolean;
  stock: number | null;
  colorVariants: ColorVariant[];
}

export interface ProductInput {
  name: string;
  slug: string;
  category: "camisa_oficial" | "camisa_torcedor";
  priceCents: number;
  imageUrl?: string | null;
  active: boolean;
  stock?: number | null;
}

export interface VariantRow {
  id: string;
  productId: string;
  color: string | null;
  colorImageUrl: string | null;
  size: string;
  stock: number | null;
  active: boolean;
}

export interface VariantInput {
  productId: string;
  color?: string | null;
  colorImageUrl?: string | null;
  size: string;
  stock?: number | null;
  active: boolean;
}

// ─── PRODUCTS ───────────────────────────────────────────────────────────────

export async function getAdminProducts(params: {
  page: number;
  category?: string;
  search?: string;
  limit?: number;
}): Promise<{ rows: ProductRow[]; total: number }> {
  const { page, category, search, limit = 20 } = params;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (category && category !== "all") {
    conditions.push(
      eq(
        products.category,
        category as "camisa_oficial" | "camisa_torcedor"
      )
    );
  }

  if (search && search.trim()) {
    const pattern = `%${search.trim()}%`;
    conditions.push(
      or(ilike(products.name, pattern), ilike(products.slug, pattern))
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ total: count() })
    .from(products)
    .where(whereClause);

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      category: products.category,
      priceCents: products.priceCents,
      imageUrl: products.imageUrl,
      active: products.active,
      stock: products.stock,
    })
    .from(products)
    .where(whereClause)
    .orderBy(desc(products.createdAt))
    .limit(limit)
    .offset(offset);

  const productIds = rows.map((r) => r.id);

  const colorVariantRows =
    productIds.length > 0
      ? await db
          .select({
            productId: productVariants.productId,
            color: productVariants.color,
            colorImageUrl: productVariants.colorImageUrl,
          })
          .from(productVariants)
          .where(and(inArray(productVariants.productId, productIds), eq(productVariants.active, true)))
      : [];

  const colorMap = new Map<string, ColorVariant[]>();
  const seen = new Set<string>();
  for (const v of colorVariantRows) {
    const key = `${v.productId}__${v.color ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const arr = colorMap.get(v.productId) ?? [];
    arr.push({ color: v.color, colorImageUrl: v.colorImageUrl });
    colorMap.set(v.productId, arr);
  }

  return {
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      category: r.category,
      priceCents: r.priceCents,
      imageUrl: r.imageUrl ?? null,
      active: r.active,
      stock: r.stock ?? null,
      colorVariants: colorMap.get(r.id) ?? [],
    })),
    total: Number(totalRow.total),
  };
}

export async function getAdminProductById(
  id: string
): Promise<(ProductRow & { variants: VariantRow[] }) | null> {
  const productRows = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!productRows[0]) return null;

  const product = productRows[0];

  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, id))
    .orderBy(desc(productVariants.createdAt));

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    category: product.category,
    priceCents: product.priceCents,
    imageUrl: product.imageUrl ?? null,
    active: product.active,
    stock: product.stock ?? null,
    colorVariants: [],
    variants: variants.map((v) => ({
      id: v.id,
      productId: v.productId,
      color: v.color ?? null,
      colorImageUrl: v.colorImageUrl ?? null,
      size: v.size,
      stock: v.stock ?? null,
      active: v.active,
    })),
  };
}

export async function createProduct(
  data: ProductInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const [product] = await db
      .insert(products)
      .values({
        name: data.name,
        slug: data.slug,
        category: data.category,
        priceCents: data.priceCents,
        imageUrl: data.imageUrl ?? null,
        active: data.active,
        stock: data.stock ?? null,
      })
      .returning({ id: products.id });

    revalidatePath("/admin/loja");
    return { success: true, id: product.id };
  } catch (err) {
    console.error("createProduct error:", err);
    return { success: false, error: "Erro ao criar produto" };
  }
}

export async function updateProduct(
  id: string,
  data: Partial<ProductInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: Partial<typeof products.$inferInsert> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.priceCents !== undefined) updateData.priceCents = data.priceCents;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl ?? null;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.stock !== undefined) updateData.stock = data.stock ?? null;

    await db.update(products).set(updateData).where(eq(products.id, id));

    revalidatePath("/admin/loja");
    revalidatePath(`/admin/loja/${id}`);
    return { success: true };
  } catch (err) {
    console.error("updateProduct error:", err);
    return { success: false, error: "Erro ao atualizar produto" };
  }
}

export async function toggleProductActive(
  id: string,
  active: boolean
): Promise<void> {
  await db.update(products).set({ active }).where(eq(products.id, id));
  revalidatePath("/admin/loja");
}

export async function deleteProduct(
  id: string
): Promise<{ success: boolean }> {
  // soft delete
  await db
    .update(products)
    .set({ active: false })
    .where(eq(products.id, id));
  revalidatePath("/admin/loja");
  return { success: true };
}

// ─── PRODUCT STOCK AGGREGATE ─────────────────────────────────────────────────

export async function getProductStockTotals(
  productIds: string[]
): Promise<Record<string, number>> {
  if (productIds.length === 0) return {};

  const rows = await db
    .select({
      productId: productVariants.productId,
      totalStock: sql<number>`coalesce(sum(${productVariants.stock}), 0)`,
    })
    .from(productVariants)
    .where(eq(productVariants.active, true))
    .groupBy(productVariants.productId);

  const map: Record<string, number> = {};
  for (const row of rows) {
    map[row.productId] = Number(row.totalStock);
  }
  return map;
}

// ─── VARIANTS ───────────────────────────────────────────────────────────────

export async function createVariant(
  data: VariantInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const [variant] = await db
      .insert(productVariants)
      .values({
        productId: data.productId,
        color: data.color ?? null,
        colorImageUrl: data.colorImageUrl ?? null,
        size: data.size,
        stock: data.stock ?? null,
        active: data.active,
      })
      .returning({ id: productVariants.id });

    revalidatePath("/admin/loja");
    revalidatePath(`/admin/loja/${data.productId}`);
    return { success: true, id: variant.id };
  } catch (err) {
    console.error("createVariant error:", err);
    return { success: false, error: "Erro ao criar variante" };
  }
}

export async function updateVariant(
  id: string,
  data: Partial<Omit<VariantInput, "productId">>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: Partial<typeof productVariants.$inferInsert> = {};
    if (data.color !== undefined) updateData.color = data.color ?? null;
    if (data.colorImageUrl !== undefined)
      updateData.colorImageUrl = data.colorImageUrl ?? null;
    if (data.size !== undefined) updateData.size = data.size;
    if (data.stock !== undefined) updateData.stock = data.stock ?? null;
    if (data.active !== undefined) updateData.active = data.active;

    await db
      .update(productVariants)
      .set(updateData)
      .where(eq(productVariants.id, id));

    revalidatePath("/admin/loja");
    return { success: true };
  } catch (err) {
    console.error("updateVariant error:", err);
    return { success: false, error: "Erro ao atualizar variante" };
  }
}

export async function deleteVariant(
  id: string
): Promise<{ success: boolean }> {
  await db.delete(productVariants).where(eq(productVariants.id, id));
  revalidatePath("/admin/loja");
  return { success: true };
}

export async function toggleVariantActive(
  id: string,
  active: boolean
): Promise<void> {
  await db
    .update(productVariants)
    .set({ active })
    .where(eq(productVariants.id, id));
  revalidatePath("/admin/loja");
}
