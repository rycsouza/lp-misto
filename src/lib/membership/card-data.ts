/**
 * Monta os dados de exibição da carteirinha a partir da leitura do sócio. Função pura:
 * quem chama (área logada e página pública) passa o link do QR e a marca do clube.
 * Só entram nome, plano, situação, datas e benefícios. E-mail, CPF e telefone nunca.
 */
import { memberHasBenefits } from "./status";
import {
  buildPlanBenefitLines,
  safeCardColor,
  type PlanBenefitLine,
} from "./plan-benefits";
import { safeLogoUrl } from "./card-visual";
import type { MemberCardView } from "./card";

export interface MemberCardData {
  name: string;
  planName: string;
  status: MemberCardView["status"];
  /** ISO */
  memberSince: string;
  /** ISO */
  nextBillingDate: string | null;
  /** Cor do plano (#RRGGBB) ou null. */
  cardColor: string | null;
  /** Cor primária do clube (fallback do cartão), validada. */
  clubColor: string | null;
  /** Logo do clube, validado (null → só o nome do clube). */
  clubLogoUrl: string | null;
  /** Benefícios exibidos: automáticos (do plano) primeiro, depois os incluídos. */
  benefits: PlanBenefitLine[];
  /** Há desconto em produtos ou ingressos (para a nota de aplicação automática). */
  hasDiscounts: boolean;
  /** Em dia, ou cancelado dentro do período pago (QR + benefícios). */
  hasBenefits: boolean;
  /** Conteúdo do QR de identificação. */
  qrValue: string;
}

export interface MemberCardClub {
  /** Cor primária da configuração do clube (pode ser vazia). */
  clubColor: string | null | undefined;
  /** `clubLogoUrl` da configuração do clube (pode ser vazio). */
  clubLogoUrl: string | null | undefined;
}

export function buildMemberCardData(
  card: MemberCardView,
  opts: { qrValue: string } & MemberCardClub,
  now: Date = new Date()
): MemberCardData {
  return {
    name: card.name,
    planName: card.planName,
    status: card.status,
    memberSince: card.memberSince.toISOString(),
    nextBillingDate: card.nextBillingDate?.toISOString() ?? null,
    cardColor: safeCardColor(card.cardColor),
    clubColor: safeCardColor(opts.clubColor),
    clubLogoUrl: safeLogoUrl(opts.clubLogoUrl),
    benefits: buildPlanBenefitLines(
      {
        ticketDiscountPct: card.ticketDiscountPct,
        productDiscountPct: card.productDiscountPct,
        freeTicketsPerHomeGame: card.freeTicketsPerHomeGame,
      },
      card.benefits
    ),
    hasDiscounts: card.ticketDiscountPct > 0 || card.productDiscountPct > 0,
    hasBenefits: memberHasBenefits(card, now),
    qrValue: opts.qrValue,
  };
}
