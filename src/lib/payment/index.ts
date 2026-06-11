import { unstable_cache } from "next/cache";
import { db } from "@/lib/db/client";
import { paymentGateways } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "./encryption";
import { AsaasGateway } from "./asaas";
import { MockGateway } from "./mock";
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

  const credentials = JSON.parse(decrypt(row.credentials));

  if (row.slug === "asaas") {
    return new AsaasGateway(credentials);
  }

  throw new Error(`Unknown gateway slug: ${row.slug}`);
}

export type { PaymentGateway, CreatePaymentInput, CreatePaymentResult } from "./types";
