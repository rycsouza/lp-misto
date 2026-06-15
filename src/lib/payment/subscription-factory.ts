import type { SubscriptionGateway } from "./subscription-types";

export async function getSubscriptionGateway(): Promise<{
  gateway: SubscriptionGateway;
  slug: string;
} | null> {
  const { db } = await import("@/lib/db/client");
  const { paymentGateways } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const { decrypt } = await import("@/lib/payment/encryption");

  const [gw] = await db
    .select()
    .from(paymentGateways)
    .where(eq(paymentGateways.active, true))
    .limit(1);

  if (!gw) {
    if (process.env.NODE_ENV === "development") {
      const { MockSubscriptionClient } = await import("./mock-subscription");
      return { gateway: new MockSubscriptionClient(), slug: "mock" };
    }
    return null;
  }

  const slug = gw.slug;
  const creds = JSON.parse(decrypt(gw.credentials)) as Record<string, unknown>;

  if (slug === "asaas" || slug.startsWith("asaas")) {
    const { AsaasSubscriptionClient } = await import("./asaas-subscription");
    return {
      gateway: new AsaasSubscriptionClient({
        apiKey: creds.apiKey as string,
        sandbox: creds.sandbox as boolean | undefined,
      }),
      slug,
    };
  }

  if (slug === "mercadopago") {
    const { MercadoPagoSubscriptionClient } = await import("./mercadopago-subscription");
    return {
      gateway: new MercadoPagoSubscriptionClient({
        accessToken: creds.accessToken as string,
        sandbox: creds.sandbox as boolean | undefined,
      }),
      slug,
    };
  }

  if (slug === "mock") {
    const { MockSubscriptionClient } = await import("./mock-subscription");
    return { gateway: new MockSubscriptionClient(), slug: "mock" };
  }

  return null;
}
