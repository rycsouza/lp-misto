import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/db/client";
import { paymentGateways } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { decrypt } from "./encryption";
import { AsaasGateway } from "./asaas";
import { MockGateway } from "./mock";
import { MercadoPagoGateway } from "./mercadopago";
import type { PaymentGateway } from "./types";

const getActiveGatewayRows = unstable_cache(
  async () => {
    const db = await getDb();
    return db.select().from(paymentGateways).where(eq(paymentGateways.active, true));
  },
  ["active-payment-gateways"],
  { tags: ["payment_gateway"], revalidate: 60 }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function instantiateGateway(slug: string, credentials: any): PaymentGateway {
  if (slug === "mock") return new MockGateway();
  if (slug === "asaas") return new AsaasGateway(credentials);
  if (slug === "mercadopago") return new MercadoPagoGateway(credentials);
  throw new Error(`Unknown gateway slug: ${slug}`);
}

export interface GatewayMeta {
  pixGatewaySlug: string | null;
  cardGatewaySlug: string | null;
  supportsCard: boolean;
  publicKey?: string;
}

/**
 * Retorna o gateway + slug correto para o método solicitado.
 * Múltiplos gateways podem estar ativos simultaneamente, cada um cobrindo
 * métodos distintos (ex: ASAAS para PIX, MercadoPago para cartão).
 */
export async function getGatewayForMethod(
  method: "pix" | "credit_card"
): Promise<{ gateway: PaymentGateway; slug: string }> {
  const rows = await getActiveGatewayRows();

  const row = rows.find((r) =>
    (r.paymentMethods ?? ["pix", "credit_card"]).includes(method)
  );

  if (!row) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[payment] Nenhum gateway para '${method}' — usando MockGateway`);
      return { gateway: new MockGateway(), slug: "mock" };
    }
    throw new Error(`Nenhum gateway ativo configurado para o método: ${method}`);
  }

  if (row.slug === "mock") return { gateway: new MockGateway(), slug: "mock" };
  const credentials = JSON.parse(decrypt(row.credentials));
  return { gateway: instantiateGateway(row.slug, credentials), slug: row.slug };
}

export async function getActiveGatewayMeta(): Promise<GatewayMeta> {
  const rows = await getActiveGatewayRows();

  if (!rows.length) {
    return { pixGatewaySlug: "mock", cardGatewaySlug: "mock", supportsCard: true };
  }

  const pixRow = rows.find((r) =>
    (r.paymentMethods ?? ["pix", "credit_card"]).includes("pix")
  ) ?? null;

  const cardRow = rows.find((r) =>
    (r.paymentMethods ?? ["pix", "credit_card"]).includes("credit_card")
  ) ?? null;

  let publicKey: string | undefined;
  if (cardRow?.slug === "mercadopago") {
    const creds = JSON.parse(decrypt(cardRow.credentials));
    publicKey = creds.publicKey as string;
  }

  return {
    pixGatewaySlug: pixRow?.slug ?? null,
    cardGatewaySlug: cardRow?.slug ?? null,
    supportsCard: !!cardRow,
    publicKey,
  };
}

export async function getPaymentGatewayBySlug(slug: string): Promise<PaymentGateway> {
  if (slug === "mock") return new MockGateway();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(paymentGateways)
    .where(eq(paymentGateways.slug, slug))
    .orderBy(desc(paymentGateways.updatedAt))
    .limit(1);

  if (!row) throw new Error(`Gateway '${slug}' não encontrado no banco.`);

  const credentials = JSON.parse(decrypt(row.credentials));
  return instantiateGateway(slug, credentials);
}

export async function getActiveGatewayWebhookSecret(): Promise<string | null> {
  const rows = await getActiveGatewayRows();
  for (const row of rows) {
    try {
      const credentials = JSON.parse(decrypt(row.credentials));
      const secret = (credentials.webhookSecret ?? credentials.webhookToken) as string | undefined;
      if (secret) return secret;
    } catch { /* continua para o próximo */ }
  }
  return null;
}

export type { PaymentGateway, CreatePaymentInput, CreatePaymentResult } from "./types";
