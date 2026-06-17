import { unstable_cache } from "next/cache";
import { db } from "@/lib/db/client";
import { paymentGateways } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { decrypt } from "./encryption";
import { AsaasGateway } from "./asaas";
import { MockGateway } from "./mock";
import { MercadoPagoGateway } from "./mercadopago";
import type { PaymentGateway } from "./types";

const getActiveGatewayRow = unstable_cache(
  async () => {
    const rows = await db
      .select()
      .from(paymentGateways)
      .where(eq(paymentGateways.active, true))
      .limit(1);
    return rows[0] ?? null;
  },
  ["active-payment-gateway"],
  { tags: ["payment_gateway"], revalidate: 60 }
);

export async function getPaymentGateway(): Promise<PaymentGateway> {
  const row = await getActiveGatewayRow();

  if (!row) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[payment] Nenhum gateway configurado — usando MockGateway (dev only)");
      return new MockGateway();
    }
    throw new Error("No active payment gateway configured");
  }

  if (row.slug === "mock") return new MockGateway();

  const credentials = JSON.parse(decrypt(row.credentials));

  if (row.slug === "asaas") return new AsaasGateway(credentials);
  if (row.slug === "mercadopago") return new MercadoPagoGateway(credentials);

  throw new Error(`Unknown gateway slug: ${row.slug}`);
}

export interface GatewayMeta {
  slug: string;
  supportsCard: boolean;
  publicKey?: string; // somente Mercado Pago
}

export async function getActiveGatewayMeta(): Promise<GatewayMeta> {
  const row = await getActiveGatewayRow();

  if (!row) {
    // Dev fallback: mock suporta cartão
    return { slug: "mock", supportsCard: true };
  }

  if (row.slug === "mock") return { slug: "mock", supportsCard: true };
  if (row.slug === "asaas") return { slug: "asaas", supportsCard: true };

  if (row.slug === "mercadopago") {
    const credentials = JSON.parse(decrypt(row.credentials));
    return {
      slug: "mercadopago",
      supportsCard: true,
      publicKey: credentials.publicKey as string,
    };
  }

  return { slug: row.slug, supportsCard: false };
}

export async function getPaymentGatewayBySlug(slug: string): Promise<PaymentGateway> {
  if (slug === "mock") return new MockGateway();

  const [row] = await db
    .select()
    .from(paymentGateways)
    .where(eq(paymentGateways.slug, slug))
    .orderBy(desc(paymentGateways.updatedAt))
    .limit(1);

  if (!row) throw new Error(`Gateway '${slug}' não encontrado no banco.`);

  const credentials = JSON.parse(decrypt(row.credentials));
  if (slug === "asaas") return new AsaasGateway(credentials);
  if (slug === "mercadopago") return new MercadoPagoGateway(credentials);

  throw new Error(`Gateway desconhecido: ${slug}`);
}

export async function getActiveGatewayWebhookSecret(): Promise<string | null> {
  const row = await getActiveGatewayRow();
  if (!row) return null;
  try {
    const credentials = JSON.parse(decrypt(row.credentials));
    return (credentials.webhookSecret as string) ?? null;
  } catch {
    return null;
  }
}

export type { PaymentGateway, CreatePaymentInput, CreatePaymentResult } from "./types";
