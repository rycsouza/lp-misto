import type { SubscriptionGateway, SubscriptionCreateInput, SubscriptionCreateResult } from "./subscription-types";
import { todayBrasilia } from "@/lib/date";

interface AsaasSubscriptionCredentials {
  apiKey: string;
  sandbox?: boolean;
}

export class AsaasSubscriptionClient implements SubscriptionGateway {
  private baseUrl: string;
  private apiKey: string;

  constructor(credentials: AsaasSubscriptionCredentials) {
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

      // 2a. Tokenize card server-side
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
            name: input.memberName,
            email: input.memberEmail,
            cpfCnpj: input.cpf.replace(/\D/g, ""),
            postalCode: card.postalCode.replace(/\D/g, ""),
            addressNumber: card.addressNumber,
            mobilePhone: input.memberPhone.replace(/\D/g, ""),
          },
        }),
      });

      // 2b. Create subscription with card token
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
          creditCardToken: tokenRes.creditCardToken,
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

export async function getAsaasSubscriptionClient(): Promise<AsaasSubscriptionClient | null> {
  const { db } = await import("@/lib/db/client");
  const { paymentGateways } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const { decrypt } = await import("@/lib/payment/encryption");

  const [gw] = await db
    .select()
    .from(paymentGateways)
    .where(eq(paymentGateways.active, true))
    .limit(1);

  if (!gw || !gw.slug.startsWith("asaas")) return null;

  const creds = JSON.parse(decrypt(gw.credentials)) as {
    apiKey: string;
    sandbox?: boolean;
  };

  return new AsaasSubscriptionClient(creds);
}
