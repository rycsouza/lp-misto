import { and, asc, eq, gt, isNotNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members, membershipPlans } from "@/lib/db/schema";
import { memberHasBenefits } from "@/lib/membership/status";
import { safeCardColor } from "@/lib/membership/plan-benefits";

/**
 * Mural dos Sócios: consulta INTERNA (página pública). Não é server action: o
 * retorno tem SÓ o nome escolhido pelo sócio e o mês/ano em que se tornou sócio,
 * agrupado por plano. Nada de e-mail, telefone, CPF, id ou data completa sai daqui.
 */

/** Teto de linhas lidas (proteção contra página gigante). */
export const WALL_LIMIT = 3000;

/** Fuso do clube: o mês/ano é o do calendário local, não o do servidor. */
const SINCE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  month: "2-digit",
  year: "numeric",
});

/** "mm/aaaa" (ex.: "03/2026") da data de adesão. Nunca a data completa. */
export function formatSocioDesde(date: Date): string {
  return SINCE_FORMATTER.format(date);
}

export interface WallEntry {
  /** Nome escolhido pelo sócio (já validado na gravação). */
  name: string;
  /** Mês/ano em que se tornou sócio, "mm/aaaa". */
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

export interface WallView {
  /** Total de nomes exibidos (somados os grupos). */
  total: number;
  /** Planos do maior preço ao menor. */
  groups: WallGroup[];
  /** true quando a consulta atingiu o teto (há mais nomes que os exibidos). */
  truncated: boolean;
}

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

/**
 * Sócios com nome no mural e benefícios vigentes (ativo, ou cancelado com período
 * já pago). O filtro do banco é só um pré-corte; a regra vale em memberHasBenefits.
 */
export async function getWallView(now: Date = new Date()): Promise<WallView> {
  const db = await getDb();
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
  let total = 0;
  for (const r of rows) {
    const name = r.wallName?.trim();
    if (!name) continue;
    if (!memberHasBenefits({ status: r.status, nextBillingDate: r.nextBillingDate }, now)) continue;
    let group = byPlan.get(r.planId);
    if (!group) {
      group = {
        planId: r.planId,
        planName: r.planName,
        priceCents: r.priceCents,
        cardColor: safeCardColor(r.cardColor),
        entries: [],
      };
      byPlan.set(r.planId, group);
    }
    group.entries.push({ name, since: formatSocioDesde(r.memberSince) });
    total++;
  }

  const groups = [...byPlan.values()]
    .sort((a, b) => b.priceCents - a.priceCents || collator.compare(a.planName, b.planName))
    .map((g) => ({
      ...g,
      entries: g.entries.sort((a, b) => collator.compare(a.name, b.name)),
    }));

  return { total, groups, truncated: rows.length >= WALL_LIMIT };
}
