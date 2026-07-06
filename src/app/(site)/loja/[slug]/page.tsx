import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getProductBySlug, getActiveProducts } from "@/lib/db/queries";
import { getSiteConfig } from "@/lib/config";
import { AddToCartButton } from "@/components/ui/AddToCartButton";
import { ShopProductCard } from "@/components/ui/ShopProductCard";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, config] = await Promise.all([
    getProductBySlug(slug),
    getSiteConfig(),
  ]);
  if (!product) return { title: "Produto não encontrado" };
  const storeName = config.siteName ? `Loja Oficial do ${config.siteName}` : "Loja Oficial";
  const title = `${product.name} — ${storeName}`;
  return {
    title,
    openGraph: { title },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, allProducts] = await Promise.all([
    getProductBySlug(slug),
    getActiveProducts().catch(() => []),
  ]);
  if (!product) notFound();

  const related = allProducts.filter((p) => p.id !== product.id).slice(0, 4);

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href="/#loja"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          Loja Oficial
        </Link>

        <p className="text-primary text-xs font-semibold tracking-widest uppercase mb-1">
          Loja Oficial
        </p>
        <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-foreground mb-6">
          {product.name}
        </h1>

        {/* Preço mora no AddToCartButton (reativo à variante selecionada) */}
        <AddToCartButton
          product={{
            id: product.id,
            slug: product.slug,
            name: product.name,
            imageUrl: product.imageUrl,
            priceCents: product.priceCents,
            displayPriceCents:
              product.salePriceCents &&
              (product.saleEndsAt == null || new Date(product.saleEndsAt) > new Date())
                ? product.salePriceCents
                : product.priceCents,
          }}
          variants={product.variants}
          colors={product.colors}
        />

        {/* Outros produtos */}
        {related.length > 0 && (
          <div className="mt-16">
            <h2 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground mb-6">
              Outros Produtos
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {related.map((p) => (
                <ShopProductCard
                  key={p.id}
                  id={p.id}
                  slug={p.slug}
                  name={p.name}
                  imageUrl={p.imageUrl}
                  priceCents={p.priceCents}
                  salePriceCents={p.salePriceCents}
                  onSale={p.onSale}
                  variantCount={p.variantCount}
                  colorVariants={p.colorVariants}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
