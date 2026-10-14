/**
 * Motivos de bloqueio do ingresso grátis do sócio. Módulo PURO (sem banco), para
 * a UI da área logada e o servidor usarem as mesmas mensagens.
 */
export type FreeTicketBlock = "inactive" | "not_paid" | "no_whatsapp" | "limit_reached";

export const FREE_TICKET_BLOCK_MESSAGE: Record<FreeTicketBlock, string> = {
  inactive: "Seus benefícios não estão ativos. Regularize sua assinatura para resgatar.",
  not_paid: "Disponível após a confirmação da 1ª mensalidade.",
  no_whatsapp: "Cadastre seu WhatsApp em Meus dados para resgatar.",
  limit_reached: "Limite atingido para este jogo.",
};
