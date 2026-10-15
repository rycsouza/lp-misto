import type { SubscriptionGateway, SubscriptionCreateInput, SubscriptionCreateResult } from "./subscription-types";

export interface MercadoPagoSubscriptionCredentials {
  accessToken: string;
  sandbox?: boolean;
}

export class MercadoPagoSubscriptionClient implements SubscriptionGateway {
  private accessToken: string;

  constructor(private credentials: MercadoPagoSubscriptionCredentials) {
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
      throw new Error(`MercadoPago ${res.status} ${path}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async createSubscription(input: SubscriptionCreateInput): Promise<SubscriptionCreateResult> {
    // Assinatura de sócio é só cartão: sem token do Brick, não há preapproval (nem link de pagamento).
    if (!input.cardTokenId) throw new Error("Assinatura Mercado Pago exige o token do cartão.");

    const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
    const backUrl = input.backUrl ?? `${appUrl}/conta?aba=socio`;

    // Cartão tokenizado pelo Brick no navegador: não precisa de redirecionamento.
    const preapproval = await this.request<{ id: string }>("/preapproval", {
      method: "POST",
      body: JSON.stringify({
        reason: `Sócio-Torcedor — ${input.planName}`,
        external_reference: input.externalRef,
        payer_email: input.memberEmail,
        card_token_id: input.cardTokenId,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: input.amountCents / 100,
          currency_id: "BRL",
        },
        back_url: backUrl,
        status: "authorized",
      }),
    });

    return {
      subscriptionId: preapproval.id,
      paymentMethod: "card",
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    await this.request(`/preapproval/${subscriptionId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "cancelled" }),
    });
    return true;
  }

  async getSubscriptionStatus(subscriptionId: string): Promise<string> {
    const sub = await this.request<{ status: string }>(`/preapproval/${subscriptionId}`);
    return sub.status;
  }
}
