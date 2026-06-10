export interface CreatePaymentInput {
  orderId: string;
  amountCents: number;
  customerName: string;
  customerEmail: string;
  description: string;
}

export interface CreatePaymentResult {
  gatewayPaymentId: string;
  pixQrCode: string;
  pixQrCodeUrl?: string;
}

export interface PaymentGateway {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  getPaymentStatus(
    gatewayPaymentId: string
  ): Promise<"pending" | "paid" | "failed" | "refunded">;
}
