/** Rótulos/cores de status do sócio no admin (lista e detalhe). */
export const MEMBER_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  active: "Ativo",
  suspended: "Suspenso",
  cancelled: "Cancelado",
};

export const MEMBER_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-600",
  active: "bg-green-500/15 text-green-600",
  suspended: "bg-orange-500/15 text-orange-600",
  cancelled: "bg-destructive/15 text-destructive",
};

/** Status de mensalidade do gateway (Asaas) → texto para o admin. */
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Pago (cartão)",
  RECEIVED: "Pago",
  RECEIVED_IN_CASH: "Pago em dinheiro",
  PENDING: "Aguardando",
  OVERDUE: "Vencido",
  REFUNDED: "Estornado",
  REFUND_REQUESTED: "Estorno solicitado",
  CHARGEBACK_REQUESTED: "Chargeback",
  AWAITING_RISK_ANALYSIS: "Em análise",
};
