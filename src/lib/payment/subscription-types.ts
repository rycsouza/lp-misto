export interface SubscriptionCreateInput {
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  cpf: string;
  externalRef: string; // memberId
  planName: string;
  amountCents: number;
  backUrl?: string;
}

export type SubscriptionPaymentMethod = "pix" | "redirect" | "immediate";

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
}
