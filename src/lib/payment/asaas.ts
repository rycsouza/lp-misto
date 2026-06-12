import type { PaymentGateway, CreatePaymentInput, CreatePaymentResult } from "./types";

interface AsaasCredentials {
  apiKey: string;
  sandbox?: boolean;
  webhookToken?: string;
}

const STATUS_MAP: Record<string, "pending" | "paid" | "failed" | "refunded"> = {
  PENDING: "pending",
  RECEIVED: "paid",
  CONFIRMED: "paid",
  OVERDUE: "failed",
  REFUNDED: "refunded",
  REFUND_REQUESTED: "refunded",
  CHARGEBACK_REQUESTED: "failed",
  CHARGEBACK_DISPUTE: "failed",
  AWAITING_CHARGEBACK_REVERSAL: "failed",
  DUNNING_REQUESTED: "failed",
  DUNNING_RECEIVED: "paid",
  AWAITING_RISK_ANALYSIS: "pending",
};

export class AsaasGateway implements PaymentGateway {
  private baseUrl: string;
  private apiKey: string;

  constructor(credentials: AsaasCredentials) {
    this.apiKey = credentials.apiKey;
    this.baseUrl = credentials.sandbox
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/v3";
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        access_token: this.apiKey,
        ...(options?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ASAAS ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const customer = await this.request<{ id: string }>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.customerName,
        email: input.customerEmail,
        externalReference: input.orderId,
      }),
    });

    const payment = await this.request<{
      id: string;
      pixQrCodeId?: string;
    }>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customer.id,
        billingType: "PIX",
        value: input.amountCents / 100,
        dueDate: new Date(Date.now() + 30 * 60 * 1000).toISOString().split("T")[0],
        description: input.description,
        externalReference: input.orderId,
      }),
    });

    const qr = await this.request<{ payload: string; encodedImage: string }>(
      `/payments/${payment.id}/pixQrCode`
    );

    return {
      gatewayPaymentId: payment.id,
      method: "pix" as const,
      pixQrCode: qr.payload,
      pixQrCodeUrl: `data:image/png;base64,${qr.encodedImage}`,
    };
  }

  async getPaymentStatus(
    gatewayPaymentId: string
  ): Promise<"pending" | "paid" | "failed" | "refunded"> {
    const payment = await this.request<{ status: string }>(
      `/payments/${gatewayPaymentId}`
    );
    return STATUS_MAP[payment.status] ?? "pending";
  }

  async refundPayment(gatewayPaymentId: string): Promise<boolean> {
    await this.request<{ id: string }>(
      `/payments/${gatewayPaymentId}/refund`,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
    return true;
  }
}
