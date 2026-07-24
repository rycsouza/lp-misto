import { cache } from "react";
import { getDb } from "@/lib/db/client";
import { raffles, raffleNumbers, rafflePrizes, orders } from "@/lib/db/schema";
import { and, eq, asc, desc, count, isNotNull, inArray } from "drizzle-orm";
import { currentTenantSlug, tenantRead } from "@/lib/db/queries";

export interface PublicPrize {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  rank: number;
}

export interface PublicRaffle {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrls: string[];
  numberPriceCents: number;
  totalNumbers: number;
  maxPerCustomer: number | null;
  status: "active" | "closed" | "drawn";
  salesEndsAt: Date | null;
  drawnAt: Date | null;
  soldCount: number;
  availableCount: number;
  prizes: PublicPrize[];
}

/** Mascara o nome do ganhador (LGPD): "João Silva" → "João S.". */
export function maskName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  const first = parts[0];
  if (parts.length === 1) return `${first} •••`;
  const last = parts[parts.length - 1];
  return `${first} ${last[0].toUpperCase()}.`;
}

type Counts = { sold: number; available: number };

/**
 * Contagem de números vendidos/disponíveis para VÁRIOS sorteios numa única
 * query (GROUP BY raffleId, status) — evita o N+1 de 1 count por sorteio.
 */
async function countsForMany(
  db: Awaited<ReturnType<typeof getDb>>,
  raffleIds: string[]
): Promise<Map<string, Counts>> {
  const map = new Map<string, Counts>();
  for (const id of raffleIds) map.set(id, { sold: 0, available: 0 });
  if (raffleIds.length === 0) return map;

  const rows = await db
    .select({ raffleId: raffleNumbers.raffleId, status: raffleNumbers.status, c: count() })
    .from(raffleNumbers)
    .where(inArray(raffleNumbers.raffleId, raffleIds))
    .groupBy(raffleNumbers.raffleId, raffleNumbers.status);

  for (const r of rows) {
    const e = map.get(r.raffleId);
    if (!e) continue;
    if (r.status === "sold") e.sold = Number(r.c);
    else if (r.status === "available") e.available = Number(r.c);
  }
  return map;
}

/**
 * Sorteio público por slug. Rascunho/cancelado ⇒ null (invisível).
 * React cache() dedupa a chamada dupla (generateMetadata + página) no mesmo
 * request; tenantRead cacheia entre requests por tenant (progresso tolera atraso).
 */
export const getPublicRaffleBySlug = cache(async (slug: string): Promise<PublicRaffle | null> => {
  const tenant = await currentTenantSlug();
  const db = await getDb();
  return tenantRead(`getPublicRaffleBySlug:${slug}`, tenant, async () => {
    const [r] = await db
      .select()
      .from(raffles)
      .where(and(eq(raffles.slug, slug), eq(raffles.active, true)))
      .limit(1);
    if (!r || r.status === "draft" || r.status === "cancelled") return null;

    const prizes = await db
      .select()
      .from(rafflePrizes)
      .where(eq(rafflePrizes.raffleId, r.id))
      .orderBy(asc(rafflePrizes.rank), asc(rafflePrizes.createdAt));

    const { sold, available } = (await countsForMany(db, [r.id])).get(r.id)!;

    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description ?? null,
      imageUrls: (r.imageUrls as string[]) ?? [],
      numberPriceCents: r.numberPriceCents,
      totalNumbers: r.totalNumbers,
      maxPerCustomer: r.maxPerCustomer ?? null,
      status: r.status as "active" | "closed" | "drawn",
      salesEndsAt: r.salesEndsAt ?? null,
      drawnAt: r.drawnAt ?? null,
      soldCount: sold,
      availableCount: available,
      prizes: prizes.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? null,
        imageUrl: p.imageUrl ?? null,
        rank: p.rank,
      })),
    };
  });
});

/** Sorteios visíveis (à venda / encerrados / sorteados), para a lista pública. */
export const listPublicRaffles = cache(async (): Promise<PublicRaffle[]> => {
  const tenant = await currentTenantSlug();
  const db = await getDb();
  return tenantRead("listPublicRaffles", tenant, async () => {
    const rows = await db
      .select()
      .from(raffles)
      .where(eq(raffles.active, true))
      .orderBy(asc(raffles.order), desc(raffles.createdAt));

    const visible = rows.filter((r) => r.status !== "draft" && r.status !== "cancelled");
    const counts = await countsForMany(db, visible.map((r) => r.id));

    return visible.map((r) => {
      const c = counts.get(r.id) ?? { sold: 0, available: 0 };
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description ?? null,
        imageUrls: (r.imageUrls as string[]) ?? [],
        numberPriceCents: r.numberPriceCents,
        totalNumbers: r.totalNumbers,
        maxPerCustomer: r.maxPerCustomer ?? null,
        status: r.status as "active" | "closed" | "drawn",
        salesEndsAt: r.salesEndsAt ?? null,
        drawnAt: r.drawnAt ?? null,
        soldCount: c.sold,
        availableCount: c.available,
        prizes: [],
      };
    });
  });
});

export interface OrderRaffleNumber {
  number: number;
  raffleName: string;
  wonPrize: string | null; // nome do prêmio, se este número foi sorteado
}

/** Números de rifa (vendidos) de um pedido, com marcação de ganhador. */
export async function getSoldNumbersForOrder(orderId: string): Promise<OrderRaffleNumber[]> {
  const db = await getDb();
  const nums = await db
    .select({ number: raffleNumbers.number, raffleId: raffleNumbers.raffleId })
    .from(raffleNumbers)
    .where(and(eq(raffleNumbers.orderId, orderId), eq(raffleNumbers.status, "sold")))
    .orderBy(asc(raffleNumbers.number));
  if (nums.length === 0) return [];

  const raffleIds = [...new Set(nums.map((n) => n.raffleId))];
  const rfs = await db.select({ id: raffles.id, name: raffles.name }).from(raffles).where(inArray(raffles.id, raffleIds));
  const nameById = new Map(rfs.map((r) => [r.id, r.name]));

  const prizes = await db
    .select({ raffleId: rafflePrizes.raffleId, winningNumber: rafflePrizes.winningNumber, name: rafflePrizes.name })
    .from(rafflePrizes)
    .where(and(inArray(rafflePrizes.raffleId, raffleIds), isNotNull(rafflePrizes.winningNumber)));
  const winMap = new Map<string, string>();
  for (const p of prizes) if (p.winningNumber != null) winMap.set(`${p.raffleId}:${p.winningNumber}`, p.name);

  return nums.map((n) => ({
    number: n.number,
    raffleName: nameById.get(n.raffleId) ?? "Rifa",
    wonPrize: winMap.get(`${n.raffleId}:${n.number}`) ?? null,
  }));
}

export interface WinnerRow {
  prizeId: string;
  prizeName: string;
  prizeImageUrl: string | null;
  rank: number;
  winningNumber: number;
  winnerName: string; // já mascarado
  winnerPhotoUrl: string | null;
  drawnAt: Date | null;
}

/** Ganhadores de um sorteio (nome mascarado). Só prêmios já sorteados. */
export const getRaffleWinners = cache(async (raffleId: string): Promise<WinnerRow[]> => {
  const tenant = await currentTenantSlug();
  const db = await getDb();
  return tenantRead(`getRaffleWinners:${raffleId}`, tenant, async () => {
    const prizes = await db
      .select()
      .from(rafflePrizes)
      .where(and(eq(rafflePrizes.raffleId, raffleId), isNotNull(rafflePrizes.winningNumber)))
      .orderBy(asc(rafflePrizes.rank));

    const winningNumbers = prizes
      .map((p) => p.winningNumber)
      .filter((n): n is number => n != null);

    // Resolve todos os compradores dos números sorteados numa query só (join).
    const nameByNumber = new Map<number, string>();
    if (winningNumbers.length > 0) {
      const rows = await db
        .select({ number: raffleNumbers.number, customerName: orders.customerName })
        .from(raffleNumbers)
        .innerJoin(orders, eq(orders.id, raffleNumbers.orderId))
        .where(and(eq(raffleNumbers.raffleId, raffleId), inArray(raffleNumbers.number, winningNumbers)));
      for (const r of rows) if (r.customerName) nameByNumber.set(r.number, maskName(r.customerName));
    }

    return prizes
      .filter((p) => p.winningNumber != null)
      .map((p) => ({
        prizeId: p.id,
        prizeName: p.name,
        prizeImageUrl: p.imageUrl ?? null,
        rank: p.rank,
        winningNumber: p.winningNumber!,
        winnerName: nameByNumber.get(p.winningNumber!) ?? "—",
        winnerPhotoUrl: p.winnerPhotoUrl ?? null,
        drawnAt: p.drawnAt ?? null,
      }));
  });
});
