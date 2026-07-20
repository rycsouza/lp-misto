import { getDb } from "@/lib/db/client";
import { raffles, raffleNumbers, rafflePrizes, orders } from "@/lib/db/schema";
import { and, eq, asc, desc, count, isNotNull } from "drizzle-orm";

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

async function countsFor(raffleId: string): Promise<{ sold: number; available: number }> {
  const db = await getDb();
  const rows = await db
    .select({ status: raffleNumbers.status, c: count() })
    .from(raffleNumbers)
    .where(eq(raffleNumbers.raffleId, raffleId))
    .groupBy(raffleNumbers.status);
  let sold = 0;
  let available = 0;
  for (const r of rows) {
    if (r.status === "sold") sold = Number(r.c);
    if (r.status === "available") available = Number(r.c);
  }
  return { sold, available };
}

/** Sorteio público por slug. Rascunho/cancelado ⇒ null (invisível). */
export async function getPublicRaffleBySlug(slug: string): Promise<PublicRaffle | null> {
  const db = await getDb();
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

  const { sold, available } = await countsFor(r.id);

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
}

/** Sorteios visíveis (à venda / encerrados / sorteados), para a lista pública. */
export async function listPublicRaffles(): Promise<PublicRaffle[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(raffles)
    .where(eq(raffles.active, true))
    .orderBy(asc(raffles.order), desc(raffles.createdAt));

  const visible = rows.filter((r) => r.status !== "draft" && r.status !== "cancelled");
  const out: PublicRaffle[] = [];
  for (const r of visible) {
    const { sold, available } = await countsFor(r.id);
    out.push({
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
      soldCount: sold,
      availableCount: available,
      prizes: [],
    });
  }
  return out;
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
export async function getRaffleWinners(raffleId: string): Promise<WinnerRow[]> {
  const db = await getDb();
  const prizes = await db
    .select()
    .from(rafflePrizes)
    .where(and(eq(rafflePrizes.raffleId, raffleId), isNotNull(rafflePrizes.winningNumber)))
    .orderBy(asc(rafflePrizes.rank));

  const out: WinnerRow[] = [];
  for (const p of prizes) {
    if (p.winningNumber == null) continue;
    // Resolve o comprador do número sorteado (se vendido).
    const [num] = await db
      .select({ orderId: raffleNumbers.orderId })
      .from(raffleNumbers)
      .where(and(eq(raffleNumbers.raffleId, raffleId), eq(raffleNumbers.number, p.winningNumber)))
      .limit(1);
    let name = "—";
    if (num?.orderId) {
      const [ord] = await db
        .select({ customerName: orders.customerName })
        .from(orders)
        .where(eq(orders.id, num.orderId))
        .limit(1);
      if (ord?.customerName) name = maskName(ord.customerName);
    }
    out.push({
      prizeId: p.id,
      prizeName: p.name,
      prizeImageUrl: p.imageUrl ?? null,
      rank: p.rank,
      winningNumber: p.winningNumber,
      winnerName: name,
      winnerPhotoUrl: p.winnerPhotoUrl ?? null,
      drawnAt: p.drawnAt ?? null,
    });
  }
  return out;
}
