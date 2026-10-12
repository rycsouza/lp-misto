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
  cardTokenId?: string;         // MP: client-side Brick token
  asaasCardData?: AsaasCardData; // Asaas: cartão enviado direto na criação da assinatura
  // Buyer IP — exigido pelo ASAAS (antifraude) em cobranças com cartão
  remoteIp?: string;
}

export type SubscriptionPaymentMethod = "card" | "pix" | "redirect" | "immediate";

export interface SubscriptionCreateResult {
  gatewayCustomerId?: string;
  subscriptionId: string;
  paymentMethod: SubscriptionPaymentMethod;
  // PIX (Asaas)
  pixQrCode?: string;
  pixQrCodeUrl?: string;
  nextDueDate?: string;
  // Redirect (Mercado Pago)
  initPoint?: string;
}

export interface SubscriptionGateway {
  createSubscription(input: SubscriptionCreateInput): Promise<SubscriptionCreateResult>;
  cancelSubscription(subscriptionId: string): Promise<boolean>;
  getSubscriptionStatus(subscriptionId: string): Promise<string>;
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
