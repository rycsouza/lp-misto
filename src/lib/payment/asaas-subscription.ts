import type { SubscriptionGateway, SubscriptionCreateInput, SubscriptionCreateResult } from "./subscription-types";
import { todayBrasilia } from "@/lib/date";

interface AsaasSubscriptionCredentials {
  apiKey: string;
  sandbox?: boolean | string;
}

export class AsaasSubscriptionClient implements SubscriptionGateway {
  private baseUrl: string;
  private apiKey: string;

  constructor(credentials: AsaasSubscriptionCredentials) {
    this.apiKey = credentials.apiKey;
    // As credenciais guardam sandbox como TEXTO ("true"/"false"); a string
    // "false" é truthy, então compara explicitamente (igual ao AsaasGateway).
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
      throw new Error(`ASAAS ${res.status} ${path}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async createSubscription(input: SubscriptionCreateInput): Promise<SubscriptionCreateResult> {
    // 1. Upsert customer in Asaas
    const customer = await this.request<{ id: string }>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.memberName,
        email: input.memberEmail,
        mobilePhone: input.memberPhone.replace(/\D/g, ""),
        cpfCnpj: input.cpf.replace(/\D/g, ""),
        externalReference: input.externalRef,
      }),
    });

    const nextDueDate = todayBrasilia();

    // ── CREDIT CARD FLOW ────────────────────────────────────────────────────
    if (input.asaasCardData) {
      const card = input.asaasCardData;

      // Cartão vai direto na criação da assinatura, sem /creditCard/tokenize
      // (em produção a tokenização exige liberação do gerente de contas). A 1ª
      // cobrança vence hoje e pode ser processada na hora; recusa → HTTP 400 e a
      // assinatura não é criada (request() lança).
      const subscription = await this.request<{ id: string }>("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          customer: customer.id,
          billingType: "CREDIT_CARD",
          value: input.amountCents / 100,
          nextDueDate,
          cycle: "MONTHLY",
          description: `Sócio-Torcedor — ${input.planName}`,
          externalReference: input.externalRef,
          creditCard: {
            holderName: card.holderName,
            number: card.number.replace(/\D/g, ""),
            expiryMonth: card.expiryMonth,
            expiryYear: card.expiryYear,
            ccv: card.ccv,
          },
          creditCardHolderInfo: {
            name: input.memberName,
            email: input.memberEmail,
            cpfCnpj: input.cpf.replace(/\D/g, ""),
            postalCode: card.postalCode.replace(/\D/g, ""),
            addressNumber: card.addressNumber,
            mobilePhone: input.memberPhone.replace(/\D/g, ""),
          },
          // IP do comprador (antifraude), na raiz do corpo.
          remoteIp: input.remoteIp ?? "127.0.0.1",
        }),
      });

      return {
        gatewayCustomerId: customer.id,
        subscriptionId: subscription.id,
        paymentMethod: "card",
        nextDueDate,
      };
    }

    // ── PIX FLOW ────────────────────────────────────────────────────────────
    const subscription = await this.request<{ id: string; status: string }>("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: customer.id,
        billingType: "PIX",
        value: input.amountCents / 100,
        nextDueDate,
        cycle: "MONTHLY",
        description: `Sócio-Torcedor — ${input.planName}`,
        externalReference: input.externalRef,
      }),
    });

    const paymentsRes = await this.request<{ data: { id: string }[] }>(
      `/subscriptions/${subscription.id}/payments`
    );
    const firstPayment = paymentsRes.data[0];
    if (!firstPayment) throw new Error("Nenhum pagamento gerado pela assinatura");

    const qr = await this.request<{ payload: string; encodedImage: string }>(
      `/payments/${firstPayment.id}/pixQrCode`
    );

    return {
      gatewayCustomerId: customer.id,
      subscriptionId: subscription.id,
      paymentMethod: "pix",
      pixQrCode: qr.payload,
      pixQrCodeUrl: `data:image/png;base64,${qr.encodedImage}`,
      nextDueDate,
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    await this.request(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
    return true;
  }

  async getSubscriptionStatus(subscriptionId: string): Promise<string> {
    const sub = await this.request<{ status: string }>(`/subscriptions/${subscriptionId}`);
    return sub.status;
  }
}
