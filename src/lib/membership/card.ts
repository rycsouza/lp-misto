import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members, membershipPlans, membershipBenefits, planBenefits } from "@/lib/db/schema";
import { safeCardColor, type PlanBenefitItem } from "@/lib/membership/plan-benefits";

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Código curto da carteirinha: 8 primeiros hex do token, em minúsculas. */
const CODE_PREFIX_RE = /^[0-9a-f]{8}$/;

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
  /** Sócio empresarial (CNPJ): `name` é a razão social e `responsibleName` o responsável. Ausente = CPF. */
  isCompany?: boolean;
  /** Responsável pela empresa (só no plano empresarial). Ausente ou NULL = sócio de CPF. */
  responsibleName?: string | null;
  /** Logo da empresa (só plano 'pj'), ainda sem validação: quem monta o cartão valida. Ausente = null. */
  companyLogoUrl?: string | null;
}

type Db = Awaited<ReturnType<typeof getDb>>;

/** Só as colunas que o cartão mostra. Nada de e-mail, CPF ou telefone. */
const CARD_FIELDS = {
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
  // Só o que o cartão mostra: a empresa e a existência de CNPJ (o número não sai daqui).
  cnpj: members.cnpj,
  companyName: members.companyName,
  // Logo da empresa: só vale para plano 'pj' (o público vem do plano atual, não do CNPJ gravado).
  logoUrl: members.logoUrl,
  planAudience: membershipPlans.audience,
};

async function readCardRows(db: Db, where: SQL, limit: number) {
  return db
    .select(CARD_FIELDS)
    .from(members)
    .leftJoin(membershipPlans, eq(members.planId, membershipPlans.id))
    .where(where)
    .limit(limit);
}

type CardRow = Awaited<ReturnType<typeof readCardRows>>[number];

/** Monta a leitura do cartão a partir de uma linha já filtrada (inclui os benefícios). */
async function toCardView(db: Db, row: CardRow): Promise<MemberCardView> {
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

  const isCompany = !!row.cnpj;
  return {
    memberId: row.memberId,
    // Sócio empresarial: o cartão mostra a razão social; o nome do responsável vai à parte.
    name: isCompany && row.companyName ? row.companyName : row.name,
    isCompany,
    responsibleName: isCompany ? row.name : null,
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
    companyLogoUrl: row.planAudience === "pj" ? (row.logoUrl ?? null) : null,
  };
}

/**
 * Dados da carteirinha pelo token (segredo do sócio, vai no link/QR). INTERNO —
 * usado só pela página da carteirinha e pela área logada. Não inclui e-mail/CPF/telefone:
 * quem lê o QR na portaria vê nome, plano e situação, nada além.
 */
export async function getMemberCardView(token: string): Promise<MemberCardView | null> {
  if (!TOKEN_RE.test(token ?? "")) return null;
  const db = await getDb();
  const [row] = await readCardRows(db, eq(members.memberCardToken, token), 1);
  if (!row) return null;
  return toCardView(db, row);
}

export type MemberCardLookupByCode =
  | { kind: "none" }
  | { kind: "ambiguous" }
  | { kind: "found"; view: MemberCardView };

/**
 * Carteirinha pelo código curto (8 primeiros hex do token, minúsculos). INTERNO: quem
 * chama já checou a permissão e normalizou o código. Lê no máximo 2 linhas: se mais de
 * um sócio casar com o prefixo, devolve "ambiguous" e não monta dado nenhum.
 * O prefixo entra como parâmetro ligado (bind), nunca concatenado no SQL.
 */
export async function getMemberCardViewByCodePrefix(prefix: string): Promise<MemberCardLookupByCode> {
  if (!CODE_PREFIX_RE.test(prefix ?? "")) return { kind: "none" };
  const db = await getDb();
  const rows = await readCardRows(
    db,
    sql`lower(${members.memberCardToken}) like ${`${prefix}%`}`,
    2
  );
  if (rows.length === 0) return { kind: "none" };
  if (rows.length > 1) return { kind: "ambiguous" };
  return { kind: "found", view: await toCardView(db, rows[0]) };
}
