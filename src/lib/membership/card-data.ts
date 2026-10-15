/**
 * Monta os dados de exibição da carteirinha a partir da leitura do sócio. Função pura:
 * quem chama (área logada e página pública) passa o link do QR, a marca do clube e o
 * fundo escolhido pelo clube (valores crus; aqui é que viram seguros).
 * Só entram nome, plano, situação, datas e benefícios. E-mail, CPF e telefone nunca.
 */
import { memberHasBenefits } from "./status";
import {
  buildPlanBenefitLines,
  safeCardColor,
  type PlanBenefitLine,
} from "./plan-benefits";
import { safeLogoUrl } from "./card-visual";
import { parseMemberCardBackground, type MemberCardBackground } from "./card-background";
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
  /**
   * Logo do clube, validado. NÃO aparece mais no cartão visual: o passe do Google
   * Carteira (src/lib/wallet/google.ts) ainda usa como logo do passe.
   */
  clubLogoUrl: string | null;
  /** Fundo escolhido pelo clube, validado (null → cartão só com a cor do plano). */
  background?: MemberCardBackground | null;
  /** Benefícios exibidos: automáticos (do plano) primeiro, depois os incluídos. */
  benefits: PlanBenefitLine[];
  /** Há desconto em produtos ou ingressos (para a nota de aplicação automática). */
  hasDiscounts: boolean;
  /** Em dia, ou cancelado dentro do período pago (QR + benefícios). */
  hasBenefits: boolean;
  /** Conteúdo do QR de identificação. */
  qrValue: string;
  /** Código curto digitável ("S-1A2B3C4D") para a equipe, ou null. Nunca o token inteiro. */
  memberCode?: string | null;
}

export interface MemberCardClub {
  /** Cor primária da configuração do clube (pode ser vazia). */
  clubColor: string | null | undefined;
  /** `clubLogoUrl` da configuração do clube (pode ser vazio). */
  clubLogoUrl: string | null | undefined;
  /** Fundo da configuração do clube, valores crus (`memberCardBackground*`). */
  cardBackground?: { url?: unknown; fit?: unknown; opacity?: unknown } | null;
  /**
   * Nome do bucket de upload. Padrão: CLOUDINARY_CLOUD_NAME. Só URL desse destino é
   * aceita como https (null: só caminho relativo do próprio site).
   */
  uploadCloudName?: string | null;
}

const MEMBER_CODE_SHAPE_RE = /^S-[0-9A-F]{8}$/;

/** Código curto só passa se tiver o formato exato (nada de texto livre na tela). */
function safeMemberCode(value: string | null | undefined): string | null {
  return typeof value === "string" && MEMBER_CODE_SHAPE_RE.test(value) ? value : null;
}

export function buildMemberCardData(
  card: MemberCardView,
  opts: { qrValue: string; memberCode?: string | null } & MemberCardClub,
  now: Date = new Date()
): MemberCardData {
  const cloudName =
    opts.uploadCloudName !== undefined ? opts.uploadCloudName : process.env.CLOUDINARY_CLOUD_NAME;
  return {
    name: card.name,
    planName: card.planName,
    status: card.status,
    memberSince: card.memberSince.toISOString(),
    nextBillingDate: card.nextBillingDate?.toISOString() ?? null,
    cardColor: safeCardColor(card.cardColor),
    clubColor: safeCardColor(opts.clubColor),
    clubLogoUrl: safeLogoUrl(opts.clubLogoUrl),
    background: parseMemberCardBackground(opts.cardBackground, cloudName),
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
    memberCode: safeMemberCode(opts.memberCode),
  };
}
