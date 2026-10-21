import type {
  SubscriptionGateway,
  SubscriptionCreateInput,
  SubscriptionCreateResult,
  SubscriptionBillingState,
  SubscriptionPaymentInfo,
} from "./subscription-types";
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
    // Assinatura de sócio é só cartão: sem dados do cartão, nem cliente nem cobrança no Asaas.
    const card = input.asaasCardData;
    if (!card) throw new Error("Assinatura Asaas exige os dados do cartão.");

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

    // Troca de plano agenda a 1ª cobrança para o próximo vencimento do plano atual.
    const today = todayBrasilia();
    const nextDueDate =
      input.firstDueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.firstDueDate) && input.firstDueDate > today
        ? input.firstDueDate
        : today;

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
        description: `${input.programName?.trim() || "Sócio-Torcedor"} — ${input.planName}`,
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

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    await this.request(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
    return true;
  }

  async getSubscriptionStatus(subscriptionId: string): Promise<string> {
    const sub = await this.request<{ status: string }>(`/subscriptions/${subscriptionId}`);
    return sub.status;
  }

  /** Referência externa da assinatura (= id do sócio, definido na criação). */
  async getSubscriptionExternalReference(subscriptionId: string): Promise<string | null> {
    const sub = await this.request<{ externalReference?: string | null }>(
      `/subscriptions/${encodeURIComponent(subscriptionId)}`
    );
    return sub.externalReference ?? null;
  }

  /**
   * Mensalidades da assinatura (mais recentes primeiro). Usada pelo histórico do
   * admin e pelo ledger local (relatórios). Pagina em lotes de 100 (campo `hasMore`
   * da lista do Asaas) até MAX_PAYMENT_PAGES. `netValue` (valor líquido) só é lido
   * quando a resposta traz o campo; ausente → null.
   */
  async listSubscriptionPayments(subscriptionId: string): Promise<SubscriptionPaymentInfo[]> {
    const base = `/subscriptions/${encodeURIComponent(subscriptionId)}/payments`;
    const out: SubscriptionPaymentInfo[] = [];
    for (let page = 0; page < MAX_PAYMENT_PAGES; page++) {
      const list = await this.request<AsaasPaymentList>(
        `${base}?limit=${PAYMENT_PAGE_SIZE}&offset=${page * PAYMENT_PAGE_SIZE}`
      );
      for (const p of list.data ?? []) out.push(mapAsaasPayment(p));
      if (!list.hasMore) break;
    }
    return out.sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? ""));
  }

  /** Situação de cobrança: pago, vencido mais antigo, próximo vencimento e fatura aberta. */
  async getBillingState(subscriptionId: string): Promise<SubscriptionBillingState> {
    const id = encodeURIComponent(subscriptionId);
    const [sub, list] = await Promise.all([
      this.request<{ nextDueDate?: string | null }>(`/subscriptions/${id}`),
      this.request<{ data?: { status?: string; dueDate?: string; invoiceUrl?: string }[] }>(
        `/subscriptions/${id}/payments?limit=100`
      ),
    ]);
    const payments = list.data ?? [];
    const byDue = (a: { dueDate?: string }, b: { dueDate?: string }) =>
      (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
    const overdue = payments.filter((p) => p.status === "OVERDUE").sort(byDue);
    const open = payments.filter((p) => OPEN_STATUSES.has(p.status ?? "")).sort(byDue);
    return {
      hasPaid: payments.some((p) => PAID_STATUSES.has(p.status ?? "")),
      oldestOverdueDueDate: overdue[0]?.dueDate ?? null,
      nextDueDate: sub.nextDueDate ?? null,
      openInvoiceUrl: safeAsaasInvoiceUrl(open[0]?.invoiceUrl),
    };
  }

  /**
   * Fonte da verdade para ativar o sócio: a assinatura tem alguma cobrança
   * paga? (CONFIRMED = cartão aprovado; RECEIVED = valor recebido).
   */
  async hasPaidCharge(subscriptionId: string): Promise<boolean> {
    const res = await this.request<{ data?: { status?: string }[] }>(
      `/subscriptions/${encodeURIComponent(subscriptionId)}/payments`
    );
    return (res.data ?? []).some((p) => PAID_STATUSES.has(p.status ?? ""));
  }
}

const PAID_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

const PAYMENT_PAGE_SIZE = 100;
/** Teto de páginas por assinatura (100 × 20 = 2.000 cobranças): limita o tempo e a cota. */
const MAX_PAYMENT_PAGES = 20;

/** Campos da cobrança que o sistema usa (a resposta do Asaas traz mais). */
interface AsaasPayment {
  id?: string;
  status?: string;
  dueDate?: string;
  value?: number;
  netValue?: number | null;
  paymentDate?: string | null;
  billingType?: string | null;
  invoiceUrl?: string;
}

interface AsaasPaymentList {
  hasMore?: boolean;
  data?: AsaasPayment[];
}

/** Reais (número do Asaas) → centavos inteiros; valor inválido → 0 (nunca NaN no banco). */
function toCents(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) : 0;
}

function mapAsaasPayment(p: AsaasPayment): SubscriptionPaymentInfo {
  return {
    dueDate: p.dueDate ?? null,
    valueCents: toCents(p.value),
    status: p.status ?? "UNKNOWN",
    invoiceUrl: safeAsaasInvoiceUrl(p.invoiceUrl),
    gatewayPaymentId: typeof p.id === "string" && p.id ? p.id : null,
    netValueCents: typeof p.netValue === "number" && Number.isFinite(p.netValue) ? toCents(p.netValue) : null,
    paymentDate: p.paymentDate ?? null,
    billingType: p.billingType ?? null,
  };
}
const OPEN_STATUSES = new Set(["PENDING", "OVERDUE"]);

/** Só aceita a página de fatura do próprio Asaas (https, domínio asaas.com). */
export function safeAsaasInvoiceUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (u.protocol !== "https:") return null;
    return host === "asaas.com" || host.endsWith(".asaas.com") ? u.toString() : null;
  } catch {
    return null;
  }
}
