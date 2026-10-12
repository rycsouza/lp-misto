import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members, membershipPlans, membershipBenefits, planBenefits } from "@/lib/db/schema";

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MemberCardView {
  memberId: string;
  name: string;
  planName: string;
  status: "pending" | "active" | "suspended" | "cancelled";
  memberSince: Date;
  nextBillingDate: Date | null;
  cancelledAt: Date | null;
  ticketDiscountPct: number;
  productDiscountPct: number;
  benefits: string[];
}

/**
 * Dados da carteirinha pelo token (segredo do sócio, vai no link/QR). INTERNO —
 * usado só pela página da carteirinha. Não inclui e-mail/CPF/telefone: quem lê o
 * QR na portaria vê nome, plano e situação, nada além.
 */
export async function getMemberCardView(token: string): Promise<MemberCardView | null> {
  if (!TOKEN_RE.test(token ?? "")) return null;
  const db = await getDb();
  const [row] = await db
    .select({
      memberId: members.id,
      name: members.name,
      status: members.status,
      createdAt: members.createdAt,
      nextBillingDate: members.nextBillingDate,
      cancelledAt: members.cancelledAt,
      planId: members.planId,
      planName: membershipPlans.name,
      ticketDiscountPct: membershipPlans.ticketDiscountPct,
      productDiscountPct: membershipPlans.productDiscountPct,
    })
    .from(members)
    .leftJoin(membershipPlans, eq(members.planId, membershipPlans.id))
    .where(eq(members.memberCardToken, token))
    .limit(1);
  if (!row) return null;

  const benefits = row.planId
    ? await db
        .select({ label: membershipBenefits.label })
        .from(planBenefits)
        .innerJoin(membershipBenefits, eq(planBenefits.benefitId, membershipBenefits.id))
        .where(and(eq(planBenefits.planId, row.planId), eq(planBenefits.included, true)))
        .orderBy(asc(membershipBenefits.order))
        .then((rows) => rows.map((r) => r.label))
        .catch(() => [] as string[])
    : [];

  return {
    memberId: row.memberId,
    name: row.name,
    planName: row.planName ?? "—",
    status: row.status as MemberCardView["status"],
    memberSince: row.createdAt,
    nextBillingDate: row.nextBillingDate,
    cancelledAt: row.cancelledAt,
    ticketDiscountPct: row.ticketDiscountPct ?? 0,
    productDiscountPct: row.productDiscountPct ?? 0,
    benefits,
  };
}
