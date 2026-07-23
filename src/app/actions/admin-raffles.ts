"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { raffles, raffleNumbers, rafflePrizes, orders, affiliates, affiliateReferrals } from "@/lib/db/schema";
import { eq, and, or, ilike, desc, asc, count, sql, inArray, isNull, isNotNull, ne } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { getAdminSession } from "./admin-auth";

/** Máximo de números por sorteio (evita geração abusiva). */
const RAFFLE_MAX_NUMBERS = 200_000;
const RAFFLE_NAME_MAX = 120;

async function requireRifas(): Promise<boolean> {
  const session = await getAdminSession();
  return !!session && (session.role === "admin" || !!session.permissions["rifas"]);
}

/** Normaliza texto livre para slug (mesma regra do cliente). */
function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
  /** Prêmios opcionais criados junto com o sorteio (na ordem informada). */
  prizes?: { name: string; description?: string | null; imageUrl?: string | null }[];
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
  status?: RaffleStatus;
}): Promise<{ rows: RaffleRow[]; total: number }> {
  if (!(await requireRifas())) throw new Error("Não autorizado");
  const db = await getDb();
  const { page, search, limit = 10, status } = params;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search && search.trim()) {
    const pattern = `%${search.trim()}%`;
    conditions.push(or(ilike(raffles.name, pattern), ilike(raffles.slug, pattern)));
  }
  if (status) conditions.push(eq(raffles.status, status));
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

  const name = (data.name ?? "").trim();
  if (!name || name.length > RAFFLE_NAME_MAX) {
    return { success: false, error: `Informe um nome de até ${RAFFLE_NAME_MAX} caracteres.` };
  }
  const slug = slugify(data.slug || name);
  if (!slug) return { success: false, error: "Slug inválido (use letras e números)." };

  const total = Math.floor(data.totalNumbers);
  if (!Number.isFinite(total) || total < 1 || total > RAFFLE_MAX_NUMBERS) {
    return { success: false, error: `Quantidade de números deve ser entre 1 e ${RAFFLE_MAX_NUMBERS}.` };
  }
  const priceCents = Math.floor(data.numberPriceCents);
  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    return { success: false, error: "Valor do número deve ser maior que zero." };
  }
  const maxPerCustomer = data.maxPerCustomer != null ? Math.floor(data.maxPerCustomer) : null;
  if (maxPerCustomer != null && (!Number.isFinite(maxPerCustomer) || maxPerCustomer < 1 || maxPerCustomer > total)) {
    return { success: false, error: "Limite por pessoa deve ser entre 1 e a quantidade de números." };
  }
  const salesEndsAt = data.salesEndsAt ? new Date(data.salesEndsAt) : null;
  if (salesEndsAt && Number.isNaN(salesEndsAt.getTime())) {
    return { success: false, error: "Data de encerramento inválida." };
  }

  const db = await getDb();
  try {
    const [raffle] = await db
      .insert(raffles)
      .values({
        name,
        slug,
        description: data.description?.trim() || null,
        imageUrls: data.imageUrls ?? [],
        numberPriceCents: priceCents,
        totalNumbers: total,
        maxPerCustomer,
        salesEndsAt,
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

    // Prêmios criados junto (na ordem informada).
    const prizes = (data.prizes ?? []).filter((p) => p.name?.trim());
    if (prizes.length > 0) {
      await db.insert(rafflePrizes).values(
        prizes.map((p, idx) => ({
          raffleId: raffle.id,
          name: p.name.trim(),
          description: p.description ?? null,
          imageUrl: p.imageUrl ?? null,
          rank: idx,
        }))
      );
    }

    await logAudit("create_raffle", "raffle", raffle.id, { name, totalNumbers: total, prizes: prizes.length });
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
    if (data.name !== undefined) {
      const name = (data.name ?? "").trim();
      if (!name || name.length > RAFFLE_NAME_MAX) return { success: false, error: `Informe um nome de até ${RAFFLE_NAME_MAX} caracteres.` };
      updateData.name = name;
    }
    if (data.slug !== undefined) {
      const slug = slugify(data.slug || "");
      if (!slug) return { success: false, error: "Slug inválido (use letras e números)." };
      updateData.slug = slug;
    }
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.imageUrls !== undefined) updateData.imageUrls = data.imageUrls;
    if (data.numberPriceCents !== undefined) {
      const priceCents = Math.floor(data.numberPriceCents);
      if (!Number.isFinite(priceCents) || priceCents <= 0) return { success: false, error: "Valor do número deve ser maior que zero." };
      updateData.numberPriceCents = priceCents;
    }
    if (data.maxPerCustomer !== undefined) {
      const max = data.maxPerCustomer != null ? Math.floor(data.maxPerCustomer) : null;
      if (max != null && (!Number.isFinite(max) || max < 1)) return { success: false, error: "Limite por pessoa deve ser de ao menos 1." };
      updateData.maxPerCustomer = max;
    }
    if (data.salesEndsAt !== undefined) {
      const ends = data.salesEndsAt ? new Date(data.salesEndsAt) : null;
      if (ends && Number.isNaN(ends.getTime())) return { success: false, error: "Data de encerramento inválida." };
      updateData.salesEndsAt = ends;
    }
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
  const name = (data.name ?? "").trim();
  if (!name || name.length > RAFFLE_NAME_MAX) return { success: false, error: `Informe um nome de até ${RAFFLE_NAME_MAX} caracteres.` };
  const db = await getDb();
  await db.insert(rafflePrizes).values({
    raffleId: data.raffleId,
    name,
    description: data.description?.trim() || null,
    imageUrl: data.imageUrl ?? null,
    rank: data.rank ?? 0,
  });
  await logAudit("create_raffle_prize", "raffle", data.raffleId, { name });
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
  if (data.name !== undefined) {
    const name = (data.name ?? "").trim();
    if (!name || name.length > RAFFLE_NAME_MAX) return { success: false, error: `Informe um nome de até ${RAFFLE_NAME_MAX} caracteres.` };
    updateData.name = name;
  }
  if (data.description !== undefined) updateData.description = data.description?.trim() || null;
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

export async function reorderRafflePrizes(ids: string[]): Promise<void> {
  if (!(await requireRifas())) return;
  const db = await getDb();
  await Promise.all(
    ids.map((id, idx) => db.update(rafflePrizes).set({ rank: idx }).where(eq(rafflePrizes.id, id)))
  );
  // revalida a página do sorteio dono do primeiro prêmio
  if (ids[0]) {
    const [row] = await db.select({ raffleId: rafflePrizes.raffleId }).from(rafflePrizes).where(eq(rafflePrizes.id, ids[0])).limit(1);
    if (row) revalidatePath(`/admin/rifas/${row.raffleId}`);
  }
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

// ─── SORTEIO (definir ganhador) ──────────────────────────────────────────────

/**
 * Define o ganhador de um prêmio informando o número sorteado. VALIDA que o
 * número foi realmente vendido — número não vendido é rejeitado (sorteie outro).
 * Quando todos os prêmios têm ganhador, o sorteio vira "drawn".
 */
export async function drawRaffleWinner(
  prizeId: string,
  winningNumber: number,
  winnerPhotoUrl?: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!(await requireRifas())) return { success: false, error: "Não autorizado." };
  const db = await getDb();

  const [prize] = await db.select().from(rafflePrizes).where(eq(rafflePrizes.id, prizeId)).limit(1);
  if (!prize) return { success: false, error: "Prêmio não encontrado." };

  const num = Math.floor(winningNumber);
  const [row] = await db
    .select({ status: raffleNumbers.status })
    .from(raffleNumbers)
    .where(and(eq(raffleNumbers.raffleId, prize.raffleId), eq(raffleNumbers.number, num)))
    .limit(1);

  if (!row) return { success: false, error: "Número fora da faixa deste sorteio." };
  if (row.status !== "sold") {
    return { success: false, error: "Esse número não foi vendido. Confira e sorteie outro." };
  }

  const session = await getAdminSession();
  await db
    .update(rafflePrizes)
    .set({ winningNumber: num, winnerPhotoUrl: winnerPhotoUrl ?? null, drawnAt: new Date(), drawnBy: session?.email ?? null })
    .where(eq(rafflePrizes.id, prizeId));

  // Se todos os prêmios já têm ganhador, marca o sorteio como realizado.
  const [pending] = await db
    .select({ c: count() })
    .from(rafflePrizes)
    .where(and(eq(rafflePrizes.raffleId, prize.raffleId), isNull(rafflePrizes.winningNumber)));
  if (Number(pending.c) === 0) {
    await db.update(raffles).set({ status: "drawn", drawnAt: new Date() }).where(eq(raffles.id, prize.raffleId));
  }

  await logAudit("draw_raffle_winner", "raffle", prize.raffleId, { prizeId, winningNumber: num });
  revalidatePath(`/admin/rifas/${prize.raffleId}`);
  return { success: true };
}

/** Remove o ganhador de um prêmio (correção). Reverte "drawn" → "closed". */
export async function clearRaffleWinner(prizeId: string): Promise<{ success: boolean }> {
  if (!(await requireRifas())) return { success: false };
  const db = await getDb();
  const [prize] = await db
    .update(rafflePrizes)
    .set({ winningNumber: null, winnerPhotoUrl: null, drawnAt: null, drawnBy: null })
    .where(eq(rafflePrizes.id, prizeId))
    .returning({ raffleId: rafflePrizes.raffleId });
  if (prize) {
    await db
      .update(raffles)
      .set({ status: "closed", drawnAt: null })
      .where(and(eq(raffles.id, prize.raffleId), eq(raffles.status, "drawn")));
    revalidatePath(`/admin/rifas/${prize.raffleId}`);
  }
  return { success: true };
}

// ─── LISTAGEM: contagem por status (abas) ────────────────────────────────────

export async function getAdminRaffleStatusCounts(): Promise<{
  all: number;
  byStatus: Record<RaffleStatus, number>;
}> {
  if (!(await requireRifas())) throw new Error("Não autorizado");
  const db = await getDb();
  const rows = await db
    .select({ status: raffles.status, c: count() })
    .from(raffles)
    .groupBy(raffles.status);
  const byStatus: Record<RaffleStatus, number> = { draft: 0, active: 0, closed: 0, drawn: 0, cancelled: 0 };
  let all = 0;
  for (const r of rows) {
    const s = r.status as RaffleStatus;
    byStatus[s] = Number(r.c);
    all += Number(r.c);
  }
  return { all, byStatus };
}

// ─── RELATÓRIO ───────────────────────────────────────────────────────────────

export interface RaffleReportPrize {
  id: string;
  name: string;
  rank: number;
  winningNumber: number | null;
  winnerName: string | null;
  drawnAt: Date | null;
}

export interface RaffleReportAffiliate {
  code: string;
  name: string;
  orders: number;
  numbers: number;
  revenueCents: number;
  commissionCents: number;
}

export interface RaffleReportData {
  id: string;
  name: string;
  slug: string;
  status: RaffleStatus;
  coverImage: string | null;
  numberPriceCents: number;
  totalNumbers: number;
  salesEndsAt: Date | null;
  drawnAt: Date | null;
  sold: number;
  reserved: number;
  available: number;
  soldPct: number;
  revenueCents: number;
  participants: number;
  prizes: RaffleReportPrize[];
  affiliates: RaffleReportAffiliate[];
}

export interface RaffleReportResult {
  picker: { id: string; name: string; status: RaffleStatus }[];
  overview: { raffles: number; sold: number; revenueCents: number };
  report: RaffleReportData | null;
}

/**
 * Relatório de rifas para /admin/relatorios?aba=rifas. Sem raffleId, seleciona o
 * primeiro da lista. Nomes de ganhadores aqui são completos (uso interno do
 * operador) — a página pública é que mascara.
 */
export async function getRaffleReport(raffleId?: string): Promise<RaffleReportResult> {
  if (!(await requireRifas())) throw new Error("Não autorizado");
  const db = await getDb();

  const list = await db
    .select({ id: raffles.id, name: raffles.name, status: raffles.status, price: raffles.numberPriceCents })
    .from(raffles)
    .orderBy(asc(raffles.order), desc(raffles.createdAt))
    .limit(200);

  // Visão geral (todas as rifas): vendidos e receita realizada. Conta apenas
  // números de pedidos PAGOS — pedido reembolsado/cancelado não entra (defensivo
  // contra números que ficaram "sold" de estornos antigos).
  const soldRows = await db
    .select({ raffleId: raffleNumbers.raffleId, c: count() })
    .from(raffleNumbers)
    .innerJoin(orders, eq(orders.id, raffleNumbers.orderId))
    .where(and(eq(raffleNumbers.status, "sold"), eq(orders.status, "paid")))
    .groupBy(raffleNumbers.raffleId);
  const soldMap: Record<string, number> = {};
  for (const s of soldRows) soldMap[s.raffleId] = Number(s.c);
  const priceMap: Record<string, number> = {};
  for (const l of list) priceMap[l.id] = l.price;
  let overviewSold = 0;
  let overviewRevenue = 0;
  for (const [rid, sold] of Object.entries(soldMap)) {
    overviewSold += sold;
    overviewRevenue += sold * (priceMap[rid] ?? 0);
  }

  const picker = list.map((l) => ({ id: l.id, name: l.name, status: l.status as RaffleStatus }));
  const overview = { raffles: list.length, sold: overviewSold, revenueCents: overviewRevenue };

  const selId = raffleId || list[0]?.id;
  if (!selId) return { picker, overview, report: null };

  const [r] = await db.select().from(raffles).where(eq(raffles.id, selId)).limit(1);
  if (!r) return { picker, overview, report: null };

  // Reservados deste sorteio (transitório, durante o PIX).
  const [reservedRow] = await db
    .select({ c: count() })
    .from(raffleNumbers)
    .where(and(eq(raffleNumbers.raffleId, selId), eq(raffleNumbers.status, "reserved")));
  const reserved = Number(reservedRow?.c ?? 0);

  // Vendidos = números de pedidos PAGOS (reembolsado não conta). Disponíveis
  // reconciliam pelo total, para não deixar "buraco" de estornos antigos.
  const [soldPaidRow] = await db
    .select({ c: count() })
    .from(raffleNumbers)
    .innerJoin(orders, eq(orders.id, raffleNumbers.orderId))
    .where(and(eq(raffleNumbers.raffleId, selId), eq(raffleNumbers.status, "sold"), eq(orders.status, "paid")));
  const sold = Number(soldPaidRow?.c ?? 0);
  const available = Math.max(0, r.totalNumbers - sold - reserved);

  // Participantes distintos (por cliente) com números em pedidos pagos.
  const [part] = await db
    .select({ c: sql<number>`count(distinct ${orders.customerId})` })
    .from(raffleNumbers)
    .innerJoin(orders, eq(orders.id, raffleNumbers.orderId))
    .where(and(eq(raffleNumbers.raffleId, selId), eq(raffleNumbers.status, "sold"), eq(orders.status, "paid")));

  // Prêmios + nome do ganhador (quando definido).
  const prizeRows = await db
    .select()
    .from(rafflePrizes)
    .where(eq(rafflePrizes.raffleId, selId))
    .orderBy(asc(rafflePrizes.rank), asc(rafflePrizes.createdAt));

  const winningNumbers = prizeRows
    .map((p) => p.winningNumber)
    .filter((n): n is number => n != null);
  const nameByNumber: Record<number, string> = {};
  if (winningNumbers.length > 0) {
    const wr = await db
      .select({ number: raffleNumbers.number, name: orders.customerName })
      .from(raffleNumbers)
      .innerJoin(orders, eq(orders.id, raffleNumbers.orderId))
      .where(and(eq(raffleNumbers.raffleId, selId), inArray(raffleNumbers.number, winningNumbers)));
    for (const w of wr) nameByNumber[w.number] = w.name;
  }

  // Afiliados: números/pedidos/receita por indicação neste sorteio.
  const affRows = await db
    .select({
      code: orders.affiliateCode,
      name: affiliates.name,
      numbers: count(),
      orderCount: sql<number>`count(distinct ${orders.id})`,
    })
    .from(raffleNumbers)
    .innerJoin(orders, eq(orders.id, raffleNumbers.orderId))
    .leftJoin(affiliates, eq(affiliates.code, orders.affiliateCode))
    .where(and(eq(raffleNumbers.raffleId, selId), eq(raffleNumbers.status, "sold"), eq(orders.status, "paid"), isNotNull(orders.affiliateCode)))
    .groupBy(orders.affiliateCode, affiliates.name);

  // Comissão registrada (não cancelada) dos pedidos PAGOS deste sorteio.
  const raffleOrderIds = db
    .select({ id: raffleNumbers.orderId })
    .from(raffleNumbers)
    .innerJoin(orders, eq(orders.id, raffleNumbers.orderId))
    .where(and(eq(raffleNumbers.raffleId, selId), eq(raffleNumbers.status, "sold"), eq(orders.status, "paid")));
  const commRows = await db
    .select({ code: orders.affiliateCode, commission: sql<number>`coalesce(sum(${affiliateReferrals.commissionCents}), 0)` })
    .from(affiliateReferrals)
    .innerJoin(orders, eq(orders.id, affiliateReferrals.orderId))
    .where(and(inArray(affiliateReferrals.orderId, raffleOrderIds), ne(affiliateReferrals.status, "cancelled"), isNotNull(orders.affiliateCode)))
    .groupBy(orders.affiliateCode);
  const commByCode: Record<string, number> = {};
  for (const c of commRows) if (c.code) commByCode[c.code] = Number(c.commission);

  const affiliatesReport: RaffleReportAffiliate[] = affRows
    .filter((a) => a.code)
    .map((a) => {
      const numbers = Number(a.numbers);
      return {
        code: a.code as string,
        name: a.name ?? (a.code as string),
        orders: Number(a.orderCount),
        numbers,
        revenueCents: numbers * r.numberPriceCents,
        commissionCents: commByCode[a.code as string] ?? 0,
      };
    })
    .sort((x, y) => y.revenueCents - x.revenueCents);

  const report: RaffleReportData = {
    id: r.id,
    name: r.name,
    slug: r.slug,
    status: r.status as RaffleStatus,
    coverImage: (r.imageUrls as string[] | null)?.[0] ?? null,
    numberPriceCents: r.numberPriceCents,
    totalNumbers: r.totalNumbers,
    salesEndsAt: r.salesEndsAt ?? null,
    drawnAt: r.drawnAt ?? null,
    sold,
    reserved,
    available,
    soldPct: r.totalNumbers > 0 ? Math.round((sold / r.totalNumbers) * 100) : 0,
    revenueCents: sold * r.numberPriceCents,
    participants: Number(part?.c ?? 0),
    prizes: prizeRows.map((p) => ({
      id: p.id,
      name: p.name,
      rank: p.rank,
      winningNumber: p.winningNumber ?? null,
      winnerName: p.winningNumber != null ? nameByNumber[p.winningNumber] ?? null : null,
      drawnAt: p.drawnAt ?? null,
    })),
    affiliates: affiliatesReport,
  };

  return { picker, overview, report };
}
