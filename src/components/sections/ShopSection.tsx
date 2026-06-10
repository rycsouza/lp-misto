import Image from "next/image";
import Link from "next/link";
import { getActiveProducts } from "@/lib/db/queries";
import SectionWrapper from "@/components/ui/section-wrapper";

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

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
              <article
                key={product.id}
                className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-[0_0_15px_rgba(193,154,90,0.4)] transition-all"
              >
                <div className="relative h-48 bg-secondary">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <span className="font-[family-name:var(--font-bebas-neue)] text-4xl text-muted-foreground">
                        MEC
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-sm text-foreground mb-1 line-clamp-2">
                    {product.name}
                  </h3>
                  <p className="text-primary font-bold text-lg mb-3">
                    {formatPrice(product.priceCents)}
                  </p>
                  {product.category === "camisa_oficial" || product.category === "camisa_torcedor" ? (
                    <a
                      href={`https://wa.me/5567991360075?text=Olá! Tenho interesse no produto: ${encodeURIComponent(product.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors"
                    >
                      Comprar
                    </a>
                  ) : (
                    <Link
                      href="/ingresso"
                      className="block w-full text-center py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors"
                    >
                      Comprar
                    </Link>
                  )}
                </div>
              </article>
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
