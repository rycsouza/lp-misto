export interface CreatePaymentInput {
  orderId: string;
  amountCents: number;
  customerName: string;
  customerEmail: string;
  description: string;
  method?: "pix" | "credit_card";
  // Credit card — obrigatórios quando method === "credit_card"
  cardToken?: string;
  installments?: number;
  paymentMethodId?: string; // "visa", "master", "amex", etc.
  identificationNumber?: string; // CPF (sem formatação)
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
