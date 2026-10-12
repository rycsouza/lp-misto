import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members, membershipPlans } from "@/lib/db/schema";

/**
 * Desconto de sócio para o checkout. INTERNO (não é server action): exposto
 * como endpoint público, permitiria descobrir se um e-mail é sócio e de qual
 * plano. Só o servidor do checkout consulta.
 */
export interface MemberDiscountInfo {
  ticketDiscountPct: number;
  productDiscountPct: number;
  planName: string;
}

export async function getMemberDiscountForEmail(
  email: string
): Promise<MemberDiscountInfo | null> {
  if (!email) return null;
  const db = await getDb();
  const rows = await db
    .select({
      status: members.status,
      ticketDiscountPct: membershipPlans.ticketDiscountPct,
      productDiscountPct: membershipPlans.productDiscountPct,
      planName: membershipPlans.name,
    })
    .from(members)
    .innerJoin(membershipPlans, eq(members.planId, membershipPlans.id))
    .where(eq(members.email, email.toLowerCase()))
    .limit(1);

  const row = rows[0];
  if (!row || row.status !== "active") return null;
  if (row.ticketDiscountPct === 0 && row.productDiscountPct === 0) return null;

  return {
    ticketDiscountPct: row.ticketDiscountPct,
    productDiscountPct: row.productDiscountPct,
    planName: row.planName,
  };
}
