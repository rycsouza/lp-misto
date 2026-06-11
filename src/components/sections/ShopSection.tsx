import { getActiveProducts } from "@/lib/db/queries";
import SectionWrapper from "@/components/ui/section-wrapper";
import { ShopProductCard } from "@/components/ui/ShopProductCard";

async function ShopSectionContent() {
  const products = await getActiveProducts().catch(() => []);

  return (
    <section id="loja" className="py-16 bg-card/10 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-primary text-sm font-semibold tracking-widest uppercase text-center mb-2">
          Loja Oficial
        </p>
        <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-center text-foreground mb-10">
          Produtos
        </h2>

        {products.length === 0 ? (
          <p className="text-muted-foreground text-center">Produtos em breve.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {products.map((product) => (
              <ShopProductCard
                key={product.id}
                id={product.id}
                slug={product.slug}
                name={product.name}
                imageUrl={product.imageUrl}
                priceCents={product.priceCents}
                variantCount={product.variantCount}
                colorVariants={product.colorVariants}
              />
            ))}
          </div>
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
