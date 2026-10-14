import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members, membershipPlans, membershipBenefits, planBenefits } from "@/lib/db/schema";
import { safeCardColor, type PlanBenefitItem } from "@/lib/membership/plan-benefits";

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
  freeTicketsPerHomeGame: number;
  /** Cor do cartão do plano (#RRGGBB) ou null → cor do clube. */
  cardColor: string | null;
  /** Benefícios incluídos no plano, com o detalhe específico do plano. */
  benefits: PlanBenefitItem[];
}

/**
 * Dados da carteirinha pelo token (segredo do sócio, vai no link/QR). INTERNO —
 * usado só pela página da carteirinha e pela área logada. Não inclui e-mail/CPF/telefone:
 * quem lê o QR na portaria vê nome, plano e situação, nada além.
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
      freeTicketsPerHomeGame: membershipPlans.freeTicketsPerHomeGame,
      cardColor: membershipPlans.cardColor,
    })
    .from(members)
    .leftJoin(membershipPlans, eq(members.planId, membershipPlans.id))
    .where(eq(members.memberCardToken, token))
    .limit(1);
  if (!row) return null;

  let benefits: PlanBenefitItem[] = [];
  if (row.planId) {
    try {
      benefits = await db
        .select({
          id: membershipBenefits.id,
          label: membershipBenefits.label,
          detail: planBenefits.detail,
        })
        .from(planBenefits)
        .innerJoin(membershipBenefits, eq(planBenefits.benefitId, membershipBenefits.id))
        .where(and(eq(planBenefits.planId, row.planId), eq(planBenefits.included, true)))
        .orderBy(asc(membershipBenefits.order));
    } catch {
      // Sem a lista, a carteirinha continua válida; só os benefícios somem.
      // O erro bruto NÃO é logado: a mensagem do driver pode trazer os parâmetros
      // da query, e o token da carteirinha é segredo.
      console.error("[carteirinha] falha ao ler benefícios do plano");
    }
  }

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
    freeTicketsPerHomeGame: row.freeTicketsPerHomeGame ?? 0,
    cardColor: safeCardColor(row.cardColor),
    benefits,
  };
}
