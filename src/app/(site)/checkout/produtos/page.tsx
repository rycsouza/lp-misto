import { ProductCheckoutWizard } from "@/components/checkout/ProductCheckoutWizard";

export const metadata = { title: "Checkout — Loja Misto EC" };

export default async function ProductCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; cupom?: string }>;
}) {
  const { step, cupom } = await searchParams;
  const skipCart = step === "dados";

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ProductCheckoutWizard initialStep={skipCart ? 1 : 0} initialCouponCode={cupom ?? null} />
      </div>
    </main>
  );
}
