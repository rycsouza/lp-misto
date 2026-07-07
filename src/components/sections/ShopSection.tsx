import { getActiveProducts } from "@/lib/db/queries";
import { getActiveFlashSale, getActivePromotionMeta } from "@/app/actions/promotions";
import { computePromotionDiscount } from "@/lib/promotions/utils";
import SectionWrapper from "@/components/ui/section-wrapper";
import { ShopGrid, type ShopGridProduct } from "@/components/sections/ShopGrid";
import { FlashSaleBanner } from "@/components/ui/FlashSaleBanner";

async function ShopSectionContent() {
  const [products, flashSale, promo] = await Promise.all([
    getActiveProducts().catch(() => []),
    getActiveFlashSale("products").catch(() => null),
    getActivePromotionMeta("products").catch(() => null),
  ]);

  return (
    <section id="loja" className="py-16 bg-card/10 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-primary text-sm font-semibold tracking-widest uppercase text-center mb-2">
          Loja Oficial
        </p>
        <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-center text-foreground mb-6">
          Produtos
        </h2>

        {flashSale && (
          <div className="mb-8">
            <FlashSaleBanner name={flashSale.name} endsAt={flashSale.endsAt.toISOString()} />
          </div>
        )}

        {products.length === 0 ? (
          <p className="text-muted-foreground text-center">Produtos em breve.</p>
        ) : (
          <ShopGrid products={products.map((product): ShopGridProduct => {
            // Preço promocional do produto tem prioridade; senão calcula da promoção ativa.
            let displaySalePriceCents = product.salePriceCents ?? null;
            let displayOnSale = product.onSale ?? false;
            if (!displayOnSale && promo) {
              const discountCents = computePromotionDiscount(product.priceCents, promo);
              if (discountCents > 0) {
                displaySalePriceCents = product.priceCents - discountCents;
                displayOnSale = true;
              }
            }
            return {
              id: product.id,
              slug: product.slug,
              name: product.name,
              imageUrl: product.imageUrl,
              category: product.category,
              priceCents: product.priceCents,
              salePriceCents: displaySalePriceCents,
              onSale: displayOnSale,
              fromPriceCents: product.fromPriceCents,
              hasMultiplePrices: product.hasMultiplePrices,
              variantCount: product.variantCount,
              colorVariants: product.colorVariants,
              comingSoon: product.comingSoon,
              lowStock: product.limitedStock,
            };
          })} />
        )}
      </div>
    </section>
  );
}

export default async function ShopSection() {
  return (
    <SectionWrapper sectionKey="shop">
      <ShopSectionContent />
    </SectionWrapper>
  );
}
