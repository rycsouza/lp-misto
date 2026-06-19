import type { PaymentGateway, CreatePaymentInput, CreatePaymentResult } from "./types";

export interface MercadoPagoCredentials {
  accessToken: string;
  publicKey: string;
  sandbox?: boolean;
  webhookSecret?: string;
}

const MP_STATUS_MAP: Record<string, "pending" | "paid" | "failed" | "refunded"> = {
  pending: "pending",
  approved: "paid",
  authorized: "pending",
  in_process: "pending",
  in_mediation: "pending",
  rejected: "failed",
  cancelled: "failed",
  refunded: "refunded",
  charged_back: "refunded",
};

/**
 * Converte o status bruto do Mercado Pago no status interno do pagamento.
 * Status desconhecido → `pending` (nunca falha por engano). Reutilizado pelo
 * webhook para garantir um mapeamento único e consistente.
 */
export function mercadoPagoToPaymentStatus(
  raw: string
): "pending" | "paid" | "failed" | "refunded" {
  return MP_STATUS_MAP[raw] ?? "pending";
}

export class MercadoPagoGateway implements PaymentGateway {
  readonly supportsCard = true;
  private accessToken: string;

  constructor(private credentials: MercadoPagoCredentials) {
    this.accessToken = credentials.accessToken;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`https://api.mercadopago.com${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
        ...(options?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`MercadoPago ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const notificationUrl =
      (process.env.APP_URL ?? "").replace(/\/$/, "") + "/api/webhooks/mercadopago";

    if (input.method === "credit_card") {
      if (!input.cardToken) throw new Error("cardToken é obrigatório para credit_card");

      const payment = await this.request<{
        id: number;
        status: string;
        status_detail: string;
      }>("/v1/payments", {
        method: "POST",
        headers: { "X-Idempotency-Key": input.orderId },
        body: JSON.stringify({
          transaction_amount: input.amountCents / 100,
          token: input.cardToken,
          description: input.description,
          installments: input.installments ?? 1,
          payment_method_id: input.paymentMethodId,
          payer: {
            email: input.customerEmail,
            identification: {
              type: "CPF",
              number: (input.identificationNumber ?? "").replace(/\D/g, ""),
            },
          },
          external_reference: input.orderId,
          notification_url: notificationUrl,
        }),
      });

      const cardStatus =
        payment.status === "approved"
          ? "approved"
          : payment.status === "in_process"
          ? "in_process"
          : "rejected";

      return {
        gatewayPaymentId: String(payment.id),
        method: "credit_card",
        cardStatus,
        cardStatusDetail: payment.status_detail,
      };
    }

    // PIX (padrão)
    const nameParts = input.customerName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : firstName;

    // PIX expira em 30 minutos
    const pixExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const dateOfExpiration = pixExpiresAt.toISOString();

    const payment = await this.request<{
      id: number;
      status: string;
      point_of_interaction?: {
        transaction_data?: { qr_code?: string; qr_code_base64?: string };
      };
    }>("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": input.orderId },
      body: JSON.stringify({
        transaction_amount: input.amountCents / 100,
        payment_method_id: "pix",
        payer: { email: input.customerEmail, first_name: firstName, last_name: lastName },
        description: input.description,
        external_reference: input.orderId,
        notification_url: notificationUrl,
        date_of_expiration: dateOfExpiration,
      }),
    });

    const txData = payment.point_of_interaction?.transaction_data;
    return {
      gatewayPaymentId: String(payment.id),
      method: "pix",
      pixQrCode: txData?.qr_code ?? "",
      pixQrCodeUrl: txData?.qr_code_base64
        ? `data:image/png;base64,${txData.qr_code_base64}`
        : undefined,
      pixExpiresAt,
    };
  }

  async getPaymentStatus(
    gatewayPaymentId: string
  ): Promise<"pending" | "paid" | "failed" | "refunded"> {
    const payment = await this.request<{ status: string }>(
      `/v1/payments/${gatewayPaymentId}`
    );
    return MP_STATUS_MAP[payment.status] ?? "pending";
  }

  async refundPayment(gatewayPaymentId: string): Promise<boolean> {
    await this.request<{ id: number }>(
      `/v1/payments/${gatewayPaymentId}/refunds`,
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: {
          // MP exige idempotency key em todas as operações de escrita
          "X-Idempotency-Key": `refund-${gatewayPaymentId}`,
        },
      }
    );
    return true;
  }
}
