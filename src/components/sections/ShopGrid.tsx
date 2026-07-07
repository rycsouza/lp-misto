"use client";

import { useState } from "react";
import { ShopProductCard } from "@/components/ui/ShopProductCard";
import { PRODUCT_CATEGORIES, CATEGORY_TAB_LABELS, type ProductCategory } from "@/lib/shop/categories";

export interface ShopGridProduct {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  category: string;
  priceCents: number;
  salePriceCents: number | null;
  onSale: boolean;
  fromPriceCents?: number;
  hasMultiplePrices?: boolean;
  variantCount: number;
  colorVariants: { color: string | null; colorImageUrl: string | null }[];
  comingSoon: boolean;
  lowStock: boolean;
}

export function ShopGrid({ products }: { products: ShopGridProduct[] }) {
  // Abas só das categorias que têm produto, na ordem canônica.
  const present = PRODUCT_CATEGORIES.filter((c) => products.some((p) => p.category === c));
  const [tab, setTab] = useState<"all" | ProductCategory>("all");

  const shown = tab === "all" ? products : products.filter((p) => p.category === tab);

  return (
    <>
      {present.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          <TabButton active={tab === "all"} onClick={() => setTab("all")}>
            Todos
          </TabButton>
          {present.map((c) => (
            <TabButton key={c} active={tab === c} onClick={() => setTab(c)}>
              {CATEGORY_TAB_LABELS[c]}
            </TabButton>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-6">
        {shown.map((product) => (
          <div key={product.id} className="w-[calc(50%-0.75rem)] sm:w-[calc(33.333%-1rem)] md:w-[260px]">
            <ShopProductCard
              id={product.id}
              slug={product.slug}
              name={product.name}
              imageUrl={product.imageUrl}
              priceCents={product.priceCents}
              salePriceCents={product.salePriceCents}
              onSale={product.onSale}
              fromPriceCents={product.fromPriceCents}
              hasMultiplePrices={product.hasMultiplePrices}
              variantCount={product.variantCount}
              colorVariants={product.colorVariants}
              comingSoon={product.comingSoon}
              lowStock={product.lowStock}
            />
          </div>
        ))}
      </div>
    </>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
