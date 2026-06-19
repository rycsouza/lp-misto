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
  asaasCardData?: AsaasCardData; // Asaas: raw card (tokenized server-side)
  // Buyer IP — required by ASAAS for anti-fraud in card tokenization
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
}
