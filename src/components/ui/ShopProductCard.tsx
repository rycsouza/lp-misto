"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Check } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/hooks/useCart";

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );
}

interface ColorVariant {
  color: string | null;
  colorImageUrl: string | null;
}

interface ShopProductCardProps {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  priceCents: number;
  salePriceCents?: number | null;
  onSale?: boolean;
  variantCount: number;
  colorVariants: ColorVariant[];
}

export function ShopProductCard({
  id,
  slug,
  name,
  imageUrl,
  salePriceCents,
  onSale,
  priceCents,
  variantCount,
  colorVariants,
}: ShopProductCardProps) {
  const [added, setAdded] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const { addItem } = useCart();
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Images to cycle — prefer color variant images, fall back to product imageUrl
  const carouselImages: string[] = colorVariants
    .map((v) => v.colorImageUrl)
    .filter((url): url is string => !!url);
  if (carouselImages.length === 0 && imageUrl) carouselImages.push(imageUrl);

  const hasCarousel = carouselImages.length > 1;

  useEffect(() => {
    if (!hasCarousel || paused) return;
    intervalRef.current = setInterval(() => {
      setActiveIdx((i) => (i + 1) % carouselImages.length);
    }, 2500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [hasCarousel, paused, carouselImages.length]);

  function handleQuickAdd(e: React.MouseEvent) {
    e.preventDefault();
    if (variantCount > 0) {
      router.push(`/loja/${slug}`);
      return;
    }
    addItem({
      productId: id,
      slug,
      name,
      imageUrl: activeImage ?? imageUrl,
      priceCents,
      variantId: null,
      color: null,
      size: null,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  const activeImage = carouselImages[activeIdx] ?? null;

  return (
    <article className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-[0_0_15px_rgba(193,154,90,0.4)] transition-all group">
      <Link
        href={`/loja/${slug}`}
        className="block relative h-48 bg-secondary overflow-hidden"
        aria-label={name}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {carouselImages.length > 0 ? (
          <>
            {carouselImages.map((src, i) => (
              <Image
                key={src}
                src={src}
                alt={i === 0 ? name : `${name} — variante ${i + 1}`}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover absolute inset-0 transition-opacity duration-700 ease-in-out"
                style={{ opacity: i === activeIdx ? 1 : 0 }}
              />
            ))}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="font-[family-name:var(--font-bebas-neue)] text-4xl text-muted-foreground">
              MEC
            </span>
          </div>
        )}

        {/* Dot indicators */}
        {hasCarousel && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 pointer-events-none">
            {carouselImages.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === activeIdx ? "bg-white scale-125" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        )}

        {/* Sale badge */}
        {onSale && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
            Promoção
          </span>
        )}

        {/* Quick-add button */}
        <button
          onClick={handleQuickAdd}
          aria-label={variantCount > 0 ? "Selecionar opções" : "Adicionar ao carrinho"}
          className="absolute bottom-2 right-2 w-9 h-9 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 hover:bg-primary/90"
        >
          {added ? <Check size={16} /> : <ShoppingCart size={16} />}
        </button>
      </Link>

      <div className="p-4">
        <h3 className="font-semibold text-sm text-foreground mb-1 line-clamp-2">{name}</h3>

        {/* Color dots */}
        {colorVariants.length > 1 && (
          <div className="flex gap-1 mb-2 flex-wrap">
            {colorVariants.map((v, i) => (
              <span
                key={i}
                title={v.color ?? undefined}
                className="text-[10px] text-muted-foreground border border-border rounded px-1 leading-4"
              >
                {v.color ?? "—"}
              </span>
            ))}
          </div>
        )}

        {onSale && salePriceCents ? (
          <div className="flex items-baseline gap-2 mb-3">
            <p className="text-red-500 font-bold text-lg">{formatPrice(salePriceCents)}</p>
            <p className="text-muted-foreground text-sm line-through">{formatPrice(priceCents)}</p>
          </div>
        ) : (
          <p className="text-primary font-bold text-lg mb-3">{formatPrice(priceCents)}</p>
        )}
        <Link
          href={`/loja/${slug}`}
          className="block w-full text-center py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors"
        >
          Comprar
        </Link>
      </div>
    </article>
  );
}
