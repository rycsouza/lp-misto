export interface AsaasCardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
}

export interface CreatePaymentInput {
  orderId: string;
  amountCents: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerCpf?: string;
  description: string;
  method?: "pix" | "credit_card";
  // MercadoPago credit card fields
  cardToken?: string;
  installments?: number;
  paymentMethodId?: string; // "visa", "master", "amex", etc.
  identificationNumber?: string; // CPF (sem formatação)
  // Asaas credit card (server-side tokenization — no browser SDK)
  asaasCardData?: AsaasCardData;
}

export interface CreatePaymentResult {
  gatewayPaymentId: string;
  method: "pix" | "credit_card";
  // PIX
  pixQrCode?: string;
  pixQrCodeUrl?: string;
  pixExpiresAt?: Date; // quando o PIX expira (30min após criação)
  // Cartão — resultado imediato
  cardStatus?: "approved" | "in_process" | "rejected";
  cardStatusDetail?: string;
}

export interface PaymentGateway {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  getPaymentStatus(
    gatewayPaymentId: string
  ): Promise<"pending" | "paid" | "failed" | "refunded">;
  refundPayment?(gatewayPaymentId: string): Promise<boolean>;
  supportsCard?: boolean;
}
