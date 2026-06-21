import { ProductCheckoutWizard } from "@/components/checkout/ProductCheckoutWizard";
import { getSiteConfig } from "@/lib/config";
import { cookies } from "next/headers";
import { COUPON_COOKIE } from "@/lib/coupon/cookie";

export const metadata = { title: "Checkout — Loja Misto EC" };

export default async function ProductCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; cupom?: string }>;
}) {
  const { step, cupom } = await searchParams;
  const skipCart = step === "dados";
  const config = await getSiteConfig();
  // Cupom vindo da URL tem prioridade; senão usa o que ficou no cookie (link da loja)
  const cookieStore = await cookies();
  const couponCode = cupom ?? cookieStore.get(COUPON_COOKIE)?.value ?? null;

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ProductCheckoutWizard
          initialStep={skipCart ? 1 : 0}
          initialCouponCode={couponCode}
          whatsapp={config.whatsapp?.trim() || undefined}
          shippingEnabled={config.shippingEnabled}
        />
      </div>
    </main>
  );
}
