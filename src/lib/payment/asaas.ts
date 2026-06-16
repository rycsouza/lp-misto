import type { PaymentGateway, CreatePaymentInput, CreatePaymentResult } from "./types";
import { todayBrasilia } from "@/lib/date";

interface AsaasCredentials {
  apiKey: string;
  sandbox?: boolean | string;
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

const CC_STATUS_MAP: Record<string, "approved" | "in_process" | "rejected"> = {
  CONFIRMED: "approved",
  RECEIVED: "approved",
  PENDING: "in_process",
  AWAITING_RISK_ANALYSIS: "in_process",
  OVERDUE: "in_process",
  DECLINED: "rejected",
  REFUNDED: "rejected",
  CHARGEBACK_REQUESTED: "rejected",
};

export class AsaasGateway implements PaymentGateway {
  private baseUrl: string;
  private apiKey: string;

  constructor(credentials: AsaasCredentials) {
    this.apiKey = credentials.apiKey;
    const isSandbox = credentials.sandbox === true || credentials.sandbox === "true";
    this.baseUrl = isSandbox
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
    const customerPayload: Record<string, string> = {
      name: input.customerName,
      email: input.customerEmail,
      externalReference: input.orderId,
    };

    if (input.customerPhone) {
      customerPayload.mobilePhone = input.customerPhone.replace(/\D/g, "");
    }
    if (input.asaasCardData?.cpfCnpj) {
      customerPayload.cpfCnpj = input.asaasCardData.cpfCnpj.replace(/\D/g, "");
    }

    const customer = await this.request<{ id: string }>("/customers", {
      method: "POST",
      body: JSON.stringify(customerPayload),
    });

    // ── CREDIT CARD FLOW ────────────────────────────────────────────────────
    if (input.method === "credit_card" && input.asaasCardData) {
      const card = input.asaasCardData;

      const tokenRes = await this.request<{ creditCardToken: string }>("/creditCard/tokenize", {
        method: "POST",
        body: JSON.stringify({
          customer: customer.id,
          creditCard: {
            holderName: card.holderName,
            number: card.number.replace(/\D/g, ""),
            expiryMonth: card.expiryMonth,
            expiryYear: card.expiryYear,
            ccv: card.ccv,
          },
          creditCardHolderInfo: {
            name: input.customerName,
            email: input.customerEmail,
            cpfCnpj: card.cpfCnpj.replace(/\D/g, ""),
            postalCode: card.postalCode.replace(/\D/g, ""),
            addressNumber: card.addressNumber,
            mobilePhone: (input.customerPhone ?? "").replace(/\D/g, ""),
          },
        }),
      });

      const payment = await this.request<{ id: string; status: string }>("/payments", {
        method: "POST",
        body: JSON.stringify({
          customer: customer.id,
          billingType: "CREDIT_CARD",
          value: input.amountCents / 100,
          dueDate: todayBrasilia(),
          description: input.description,
          externalReference: input.orderId,
          creditCardToken: tokenRes.creditCardToken,
          installmentCount: input.installments ?? 1,
        }),
      });

      return {
        gatewayPaymentId: payment.id,
        method: "credit_card",
        cardStatus: CC_STATUS_MAP[payment.status] ?? "in_process",
      };
    }

    // ── PIX FLOW ────────────────────────────────────────────────────────────
    const payment = await this.request<{
      id: string;
      pixQrCodeId?: string;
    }>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customer.id,
        billingType: "PIX",
        value: input.amountCents / 100,
        dueDate: todayBrasilia(),
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
