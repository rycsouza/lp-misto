import { and, asc, eq, gt, isNotNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members, membershipPlans } from "@/lib/db/schema";
import { memberHasBenefits } from "@/lib/membership/status";

/**
 * Mural dos Sócios: consulta INTERNA (página pública). Não é server action: o
 * retorno tem SÓ o nome escolhido pelo sócio, agrupado por plano. Nada de e-mail,
 * telefone, CPF ou id do sócio sai daqui.
 */

/** Teto de linhas lidas (proteção contra página gigante). */
export const WALL_LIMIT = 3000;

export interface WallGroup {
  planId: string;
  planName: string;
  priceCents: number;
  /** Nomes escolhidos pelos sócios, em ordem alfabética. */
  names: string[];
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
      planId: membershipPlans.id,
      planName: membershipPlans.name,
      priceCents: membershipPlans.priceCents,
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
      group = { planId: r.planId, planName: r.planName, priceCents: r.priceCents, names: [] };
      byPlan.set(r.planId, group);
    }
    group.names.push(name);
    total++;
  }

  const groups = [...byPlan.values()]
    .sort((a, b) => b.priceCents - a.priceCents || collator.compare(a.planName, b.planName))
    .map((g) => ({ ...g, names: g.names.sort((a, b) => collator.compare(a, b)) }));

  return { total, groups, truncated: rows.length >= WALL_LIMIT };
}
