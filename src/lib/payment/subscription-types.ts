export interface AsaasCardData {
  holderName: string;
  number: string;       // raw digits only
  expiryMonth: string;  // "01"–"12"
  expiryYear: string;   // full year "2028"
  ccv: string;
  postalCode: string;   // digits only
  addressNumber: string;
}

export interface SubscriptionCreateInput {
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  cpf: string;
  externalRef: string; // memberId
  planName: string;
  amountCents: number;
  backUrl?: string;
  /** MP: token do Brick (cartão). Obrigatório no Mercado Pago. */
  cardTokenId?: string;
  /** Asaas: cartão enviado direto na criação da assinatura. Obrigatório no Asaas. */
  asaasCardData?: AsaasCardData;
  // Buyer IP — exigido pelo ASAAS (antifraude) em cobranças com cartão
  remoteIp?: string;
  /** 1ª cobrança (AAAA-MM-DD). Padrão: hoje. Troca de plano: próximo vencimento. */
  firstDueDate?: string;
}

/** Assinatura de sócio só existe com cartão ("immediate" = gateway mock de dev/teste). */
export type SubscriptionPaymentMethod = "card" | "immediate";

export interface SubscriptionCreateResult {
  gatewayCustomerId?: string;
  subscriptionId: string;
  paymentMethod: SubscriptionPaymentMethod;
  nextDueDate?: string;
}

export interface SubscriptionGateway {
  createSubscription(input: SubscriptionCreateInput): Promise<SubscriptionCreateResult>;
  cancelSubscription(subscriptionId: string): Promise<boolean>;
  getSubscriptionStatus(subscriptionId: string): Promise<string>;
  /** Mensalidades da assinatura (admin: histórico). */
  listSubscriptionPayments?(subscriptionId: string): Promise<SubscriptionPaymentInfo[]>;
  /** Situação de cobrança da assinatura (fonte da verdade para em dia/atraso). */
  getBillingState?(subscriptionId: string): Promise<SubscriptionBillingState>;
  /** Há cobrança paga nesta assinatura? (consulta o gateway — fonte da verdade) */
  hasPaidCharge?(subscriptionId: string): Promise<boolean>;
  /** Referência externa gravada na criação (id do sócio). */
  getSubscriptionExternalReference?(subscriptionId: string): Promise<string | null>;
}

export interface SubscriptionBillingState {
  /** Alguma mensalidade paga (CONFIRMED/RECEIVED). */
  hasPaid: boolean;
  /** Vencimento (AAAA-MM-DD) da mensalidade VENCIDA mais antiga, se houver. */
  oldestOverdueDueDate: string | null;
  /** Próximo vencimento da assinatura (AAAA-MM-DD). */
  nextDueDate: string | null;
  /** Fatura em aberto mais antiga (pendente/vencida) — página de pagamento do gateway. */
  openInvoiceUrl: string | null;
}

export interface SubscriptionPaymentInfo {
  dueDate: string | null;
  valueCents: number;
  /** Status bruto do gateway (ex.: CONFIRMED, RECEIVED, PENDING, OVERDUE, REFUNDED). */
  status: string;
  invoiceUrl: string | null;
  /** Id da cobrança no gateway (chave do ledger local). NULL se o gateway não informar. */
  gatewayPaymentId: string | null;
  /** Valor líquido após a taxa do gateway. NULL quando o gateway não informa. */
  netValueCents: number | null;
  /** Data do pagamento (AAAA-MM-DD). NULL enquanto não foi pago. */
  paymentDate: string | null;
  /** Forma de pagamento do gateway (ex.: CREDIT_CARD). */
  billingType: string | null;
}
