import { and, asc, eq, gt, isNotNull, or } from "drizzle-orm";
import { wallDisplayName } from "./wall-name";
import { getDb } from "@/lib/db/client";
import { currentTenantSlug, tenantRead } from "@/lib/db/queries";
import { members, membershipPlans } from "@/lib/db/schema";
import { memberHasBenefits } from "@/lib/membership/status";
import { safeCardColor } from "@/lib/membership/plan-benefits";
import { safeMemberPhotoUrl } from "@/lib/membership/member-photo";

/**
 * Mural dos Sócios: consulta INTERNA (página pública). Não é server action: o
 * retorno tem SÓ o nome escolhido pelo sócio, a data (dd/mm/aaaa) em que se tornou
 * sócio, o plano e a foto (se enviada e válida). Nada de e-mail, telefone, CPF, id,
 * hora nem o public_id da foto sai daqui.
 */

/** Teto de linhas lidas (proteção contra página gigante). */
export const WALL_LIMIT = 3000;

/** Fuso do clube: a data é a do calendário local, não a do servidor. */
const SINCE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Dia do clube (aaaa-mm-dd): semeia a ordem do carrossel, que muda a cada dia. */
const DAY_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** "dd/mm/aaaa" (ex.: "31/03/2026") da data de adesão, só a data, sem hora. */
export function formatSocioDesde(date: Date): string {
  return SINCE_FORMATTER.format(date);
}

export { wallDisplayName };

export interface WallEntry {
  /** Nome curto do mural ("Maria S."), já no formato público. */
  name: string;
  /** Data em que se tornou sócio, "dd/mm/aaaa" (fuso de São Paulo). */
  since: string;
}

export interface WallGroup {
  planId: string;
  planName: string;
  priceCents: number;
  /** Cor do plano já validada (#rrggbb) ou null. */
  cardColor: string | null;
  /** Sócios do plano, em ordem alfabética pelo nome. */
  entries: WallEntry[];
}

/** Um cartão do mural: nome curto, data, plano (com cor validada), foto validada e nível. */
export interface WallCard {
  name: string;
  since: string;
  planName: string;
  /** Cor do plano já validada (#rrggbb) ou null. */
  cardColor: string | null;
  /** URL de entrega da foto do Cloudinary do projeto, ou null (sem foto ou URL recusada). */
  photoUrl: string | null;
  /** Nível do plano pelo preço no mural: 0 = o mais caro; planos de mesmo preço dividem o nível. */
  tier: number;
}

/**
 * Níveis do mural pelo preço: o preço mais alto é o nível 0; cada preço distinto abaixo ganha
 * o próximo número. Só o preço entra aqui (nada de nome, plano ou sócio).
 */
export function wallTiers(prices: number[]): Map<number, number> {
  const distinct = [...new Set(prices)].sort((a, b) => b - a);
  return new Map(distinct.map((price, i) => [price, i]));
}

export interface WallView {
  /** Total de nomes exibidos (somados os grupos). */
  total: number;
  /** Planos do maior preço ao menor. */
  groups: WallGroup[];
  /** Todos os sócios numa lista só, em ordem que muda a cada dia (planos misturados). */
  cards: WallCard[];
  /** true quando a consulta atingiu o teto (há mais nomes que os exibidos). */
  truncated: boolean;
}

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

/** FNV-1a 32 bits: hash estável entre execuções (sem Math.random, sem diferença de hidratação). */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Ordem do carrossel para um dia: embaralhada pelo hash de (dia, nome, plano, data). Mesmo
 * dia = mesma ordem; outro dia = outra ordem. Os planos se misturam naturalmente.
 */
export function wallCardOrder(cards: WallCard[], dayKey: string): WallCard[] {
  return cards
    .map((card) => ({ card, key: fnv1a(`${dayKey}|${card.name}|${card.planName}|${card.since}`) }))
    .sort(
      (a, b) =>
        a.key - b.key ||
        collator.compare(a.card.name, b.card.name) ||
        collator.compare(a.card.planName, b.card.planName)
    )
    .map((x) => x.card);
}

type WallDb = Awaited<ReturnType<typeof getDb>>;

/**
 * Sócios com nome no mural e benefícios vigentes (ativo, ou cancelado com período
 * já pago). O filtro do banco é só um pré-corte; a regra vale em memberHasBenefits.
 */
export async function getWallView(now: Date = new Date()): Promise<WallView> {
  const db = await getDb();
  return readWallView(db, now);
}

/**
 * Mural na home: o mesmo retorno de getWallView, em cache de leitura POR CLUBE (chave
 * com o slug do tenant, TTL curto de tenantRead). O db e o slug são resolvidos FORA do
 * cache (getDb lê headers); o cache só envolve a consulta.
 */
export async function getHomeWallView(): Promise<WallView> {
  const tenant = await currentTenantSlug();
  const db = await getDb();
  return tenantRead("getHomeWallView", tenant, () => readWallView(db, new Date()));
}

async function readWallView(db: WallDb, now: Date): Promise<WallView> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const rows = await db
    .select({
      wallName: members.wallName,
      status: members.status,
      nextBillingDate: members.nextBillingDate,
      memberSince: members.createdAt,
      planId: membershipPlans.id,
      planName: membershipPlans.name,
      priceCents: membershipPlans.priceCents,
      cardColor: membershipPlans.cardColor,
      photoUrl: members.photoUrl,
    })
    .from(members)
    .innerJoin(membershipPlans, eq(members.planId, membershipPlans.id))
    .where(
      and(
        isNotNull(members.wallName),
        or(
          eq(members.status, "active"),
          and(eq(members.status, "cancelled"), gt(members.nextBillingDate, now))
        )
      )
    )
    .orderBy(asc(members.wallName))
    .limit(WALL_LIMIT);

  const byPlan = new Map<string, WallGroup>();
  const pending: { card: Omit<WallCard, "tier">; priceCents: number }[] = [];
  let total = 0;
  for (const r of rows) {
    const name = r.wallName?.trim();
    if (!name) continue;
    if (!memberHasBenefits({ status: r.status, nextBillingDate: r.nextBillingDate }, now)) continue;
    const displayName = wallDisplayName(name);
    const since = formatSocioDesde(r.memberSince);
    const cardColor = safeCardColor(r.cardColor);
    let group = byPlan.get(r.planId);
    if (!group) {
      group = {
        planId: r.planId,
        planName: r.planName,
        priceCents: r.priceCents,
        cardColor,
        entries: [],
      };
      byPlan.set(r.planId, group);
    }
    group.entries.push({ name: displayName, since });
    pending.push({
      card: {
        name: displayName,
        since,
        planName: r.planName,
        cardColor,
        photoUrl: safeMemberPhotoUrl(r.photoUrl, cloudName),
      },
      priceCents: r.priceCents,
    });
    total++;
  }

  const tiers = wallTiers(pending.map((p) => p.priceCents));
  const cards: WallCard[] = pending.map((p) => ({ ...p.card, tier: tiers.get(p.priceCents) ?? 0 }));

  const groups = [...byPlan.values()]
    .sort((a, b) => b.priceCents - a.priceCents || collator.compare(a.planName, b.planName))
    .map((g) => ({
      ...g,
      entries: g.entries.sort((a, b) => collator.compare(a.name, b.name)),
    }));

  return {
    total,
    groups,
    cards: wallCardOrder(cards, DAY_KEY_FORMATTER.format(now)),
    truncated: rows.length >= WALL_LIMIT,
  };
}
