"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { raffles, raffleNumbers, rafflePrizes } from "@/lib/db/schema";
import { eq, and, or, ilike, desc, asc, count, sql, inArray } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { getAdminSession } from "./admin-auth";

/** Máximo de números por sorteio (evita geração abusiva). */
const RAFFLE_MAX_NUMBERS = 200_000;

async function requireRifas(): Promise<boolean> {
  const session = await getAdminSession();
  return !!session && (session.role === "admin" || !!session.permissions["rifas"]);
}

// ─── Types ─────────────────────────────────────────────────────────────────

export type RaffleStatus = "draft" | "active" | "closed" | "drawn" | "cancelled";

export interface RaffleRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrls: string[];
  numberPriceCents: number;
  totalNumbers: number;
  maxPerCustomer: number | null;
  status: RaffleStatus;
  salesEndsAt: Date | null;
  drawnAt: Date | null;
  active: boolean;
  order: number;
  soldCount: number;
}

export interface RafflePrizeRow {
  id: string;
  raffleId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  rank: number;
  winningNumber: number | null;
  winnerPhotoUrl: string | null;
  drawnAt: Date | null;
  drawnBy: string | null;
}

export interface RaffleInput {
  name: string;
  slug: string;
  description?: string | null;
  imageUrls?: string[];
  numberPriceCents: number;
  totalNumbers: number;
  maxPerCustomer?: number | null;
  salesEndsAt?: Date | null;
  status?: RaffleStatus;
  active?: boolean;
}

// ─── Números vendidos (para barra de progresso) ──────────────────────────────

async function soldCountsByRaffle(raffleIds: string[]): Promise<Record<string, number>> {
  if (raffleIds.length === 0) return {};
  const db = await getDb();
  const rows = await db
    .select({ raffleId: raffleNumbers.raffleId, sold: count() })
    .from(raffleNumbers)
    .where(and(inArray(raffleNumbers.raffleId, raffleIds), eq(raffleNumbers.status, "sold")))
    .groupBy(raffleNumbers.raffleId);
  const map: Record<string, number> = {};
  for (const r of rows) map[r.raffleId] = Number(r.sold);
  return map;
}

// ─── RAFFLES ─────────────────────────────────────────────────────────────────

export async function getAdminRaffles(params: {
  page: number;
  search?: string;
  limit?: number;
}): Promise<{ rows: RaffleRow[]; total: number }> {
  if (!(await requireRifas())) throw new Error("Não autorizado");
  const db = await getDb();
  const { page, search, limit = 10 } = params;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search && search.trim()) {
    const pattern = `%${search.trim()}%`;
    conditions.push(or(ilike(raffles.name, pattern), ilike(raffles.slug, pattern)));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ total: count() }).from(raffles).where(whereClause);

  const rows = await db
    .select()
    .from(raffles)
    .where(whereClause)
    .orderBy(asc(raffles.order), desc(raffles.createdAt))
    .limit(limit)
    .offset(offset);

  const sold = await soldCountsByRaffle(rows.map((r) => r.id));

  return {
    rows: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description ?? null,
      imageUrls: (r.imageUrls as string[]) ?? [],
      numberPriceCents: r.numberPriceCents,
      totalNumbers: r.totalNumbers,
      maxPerCustomer: r.maxPerCustomer ?? null,
      status: r.status as RaffleStatus,
      salesEndsAt: r.salesEndsAt ?? null,
      drawnAt: r.drawnAt ?? null,
      active: r.active,
      order: r.order,
      soldCount: sold[r.id] ?? 0,
    })),
    total: Number(totalRow.total),
  };
}

export async function getAdminRaffleById(
  id: string
): Promise<(RaffleRow & { prizes: RafflePrizeRow[] }) | null> {
  if (!(await requireRifas())) throw new Error("Não autorizado");
  const db = await getDb();
  const [r] = await db.select().from(raffles).where(eq(raffles.id, id)).limit(1);
  if (!r) return null;

  const prizes = await db
    .select()
    .from(rafflePrizes)
    .where(eq(rafflePrizes.raffleId, id))
    .orderBy(asc(rafflePrizes.rank), asc(rafflePrizes.createdAt));

  const sold = await soldCountsByRaffle([id]);

  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description ?? null,
    imageUrls: (r.imageUrls as string[]) ?? [],
    numberPriceCents: r.numberPriceCents,
    totalNumbers: r.totalNumbers,
    maxPerCustomer: r.maxPerCustomer ?? null,
    status: r.status as RaffleStatus,
    salesEndsAt: r.salesEndsAt ?? null,
    drawnAt: r.drawnAt ?? null,
    active: r.active,
    order: r.order,
    soldCount: sold[id] ?? 0,
    prizes: prizes.map((p) => ({
      id: p.id,
      raffleId: p.raffleId,
      name: p.name,
      description: p.description ?? null,
      imageUrl: p.imageUrl ?? null,
      rank: p.rank,
      winningNumber: p.winningNumber ?? null,
      winnerPhotoUrl: p.winnerPhotoUrl ?? null,
      drawnAt: p.drawnAt ?? null,
      drawnBy: p.drawnBy ?? null,
    })),
  };
}

export async function createRaffle(
  data: RaffleInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!(await requireRifas())) return { success: false, error: "Não autorizado." };

  const total = Math.floor(data.totalNumbers);
  if (!Number.isFinite(total) || total < 1 || total > RAFFLE_MAX_NUMBERS) {
    return { success: false, error: `Quantidade de números deve ser entre 1 e ${RAFFLE_MAX_NUMBERS}.` };
  }
  if (!Number.isFinite(data.numberPriceCents) || data.numberPriceCents < 0) {
    return { success: false, error: "Valor do número inválido." };
  }

  const db = await getDb();
  try {
    const [raffle] = await db
      .insert(raffles)
      .values({
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        imageUrls: data.imageUrls ?? [],
        numberPriceCents: data.numberPriceCents,
        totalNumbers: total,
        maxPerCustomer: data.maxPerCustomer ?? null,
        salesEndsAt: data.salesEndsAt ?? null,
        status: data.status ?? "draft",
        active: data.active ?? true,
      })
      .returning({ id: raffles.id });

    // Pré-gera todos os números num único statement (generate_series) — atômico,
    // rápido mesmo p/ centenas de milhares de linhas.
    await db.execute(
      sql`INSERT INTO raffle_numbers (raffle_id, number)
          SELECT ${raffle.id}::uuid, gs FROM generate_series(1, ${total}) AS gs`
    );

    await logAudit("create_raffle", "raffle", raffle.id, { name: data.name, totalNumbers: total });
    revalidatePath("/admin/rifas");
    return { success: true, id: raffle.id };
  } catch (err) {
    console.error("createRaffle error:", err);
    return { success: false, error: "Erro ao criar sorteio (slug já existe?)" };
  }
}

export async function updateRaffle(
  id: string,
  data: Partial<Omit<RaffleInput, "totalNumbers">>
): Promise<{ success: boolean; error?: string }> {
  if (!(await requireRifas())) return { success: false, error: "Não autorizado." };
  const db = await getDb();
  try {
    // totalNumbers é imutável após a criação (os números já foram gerados).
    const updateData: Partial<typeof raffles.$inferInsert> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description ?? null;
    if (data.imageUrls !== undefined) updateData.imageUrls = data.imageUrls;
    if (data.numberPriceCents !== undefined) updateData.numberPriceCents = data.numberPriceCents;
    if (data.maxPerCustomer !== undefined) updateData.maxPerCustomer = data.maxPerCustomer ?? null;
    if (data.salesEndsAt !== undefined) updateData.salesEndsAt = data.salesEndsAt ?? null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.active !== undefined) updateData.active = data.active;

    if (Object.keys(updateData).length === 0) return { success: false, error: "Nada para atualizar." };
    await db.update(raffles).set(updateData).where(eq(raffles.id, id));

    await logAudit("update_raffle", "raffle", id, data.name ? { name: data.name } : null);
    revalidatePath("/admin/rifas");
    revalidatePath(`/admin/rifas/${id}`);
    return { success: true };
  } catch (err) {
    console.error("updateRaffle error:", err);
    return { success: false, error: "Erro ao atualizar sorteio" };
  }
}

export async function setRaffleStatus(
  id: string,
  status: RaffleStatus
): Promise<{ success: boolean; error?: string }> {
  if (!(await requireRifas())) return { success: false, error: "Não autorizado." };
  const db = await getDb();
  await db.update(raffles).set({ status }).where(eq(raffles.id, id));
  await logAudit("set_raffle_status", "raffle", id, { status });
  revalidatePath("/admin/rifas");
  revalidatePath(`/admin/rifas/${id}`);
  return { success: true };
}

export async function toggleRaffleActive(id: string, active: boolean): Promise<void> {
  if (!(await requireRifas())) return;
  const db = await getDb();
  await db.update(raffles).set({ active }).where(eq(raffles.id, id));
  revalidatePath("/admin/rifas");
}

export async function deleteRaffle(id: string): Promise<{ success: boolean }> {
  if (!(await requireRifas())) return { success: false };
  const db = await getDb();
  await db.update(raffles).set({ active: false }).where(eq(raffles.id, id));
  await logAudit("delete_raffle", "raffle", id);
  revalidatePath("/admin/rifas");
  return { success: true };
}

export async function reorderRaffles(ids: string[]): Promise<void> {
  if (!(await requireRifas())) return;
  const db = await getDb();
  await Promise.all(
    ids.map((id, idx) => db.update(raffles).set({ order: idx }).where(eq(raffles.id, id)))
  );
  revalidatePath("/admin/rifas");
}

// ─── PRIZES ──────────────────────────────────────────────────────────────────

export interface PrizeInput {
  raffleId: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  rank?: number;
}

export async function createRafflePrize(data: PrizeInput): Promise<{ success: boolean; error?: string }> {
  if (!(await requireRifas())) return { success: false, error: "Não autorizado." };
  const db = await getDb();
  await db.insert(rafflePrizes).values({
    raffleId: data.raffleId,
    name: data.name,
    description: data.description ?? null,
    imageUrl: data.imageUrl ?? null,
    rank: data.rank ?? 0,
  });
  await logAudit("create_raffle_prize", "raffle", data.raffleId, { name: data.name });
  revalidatePath(`/admin/rifas/${data.raffleId}`);
  return { success: true };
}

export async function updateRafflePrize(
  id: string,
  data: { name?: string; description?: string | null; imageUrl?: string | null; rank?: number }
): Promise<{ success: boolean; error?: string }> {
  if (!(await requireRifas())) return { success: false, error: "Não autorizado." };
  const db = await getDb();
  const updateData: Partial<typeof rafflePrizes.$inferInsert> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description ?? null;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl ?? null;
  if (data.rank !== undefined) updateData.rank = data.rank;
  if (Object.keys(updateData).length === 0) return { success: false, error: "Nada para atualizar." };

  const [row] = await db
    .update(rafflePrizes)
    .set(updateData)
    .where(eq(rafflePrizes.id, id))
    .returning({ raffleId: rafflePrizes.raffleId });
  if (row) revalidatePath(`/admin/rifas/${row.raffleId}`);
  return { success: true };
}

export async function deleteRafflePrize(id: string): Promise<{ success: boolean }> {
  if (!(await requireRifas())) return { success: false };
  const db = await getDb();
  const [row] = await db
    .delete(rafflePrizes)
    .where(eq(rafflePrizes.id, id))
    .returning({ raffleId: rafflePrizes.raffleId });
  if (row) revalidatePath(`/admin/rifas/${row.raffleId}`);
  return { success: true };
}
