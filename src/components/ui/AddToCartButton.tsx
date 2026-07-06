"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ShoppingCart, Check } from "lucide-react";
import { useCart } from "@/hooks/useCart";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

interface Variant {
  id: string;
  color: string | null;
  colorImageUrl: string | null;
  size: string;
  stock: number | null;
  priceCents: number | null;
}

interface ColorOption {
  color: string;
  colorImageUrl: string | null;
}

interface ProductInfo {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  /** Preço de tabela (original) — usado como valor "cortado" quando há desconto. */
  priceCents: number;
  /** Preço atual do produto já considerando promoção vigente (calculado no server). */
  displayPriceCents: number;
}

interface AddToCartButtonProps {
  product: ProductInfo;
  variants: Variant[];
  colors: ColorOption[];
}

export function AddToCartButton({ product, variants, colors }: AddToCartButtonProps) {
  const [selectedColor, setSelectedColor] = useState<string | null>(
    colors.length > 0 ? colors[0].color : null
  );
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();
  const router = useRouter();

  // Image reactive to selected color
  const currentColorData = colors.find((c) => c.color === selectedColor);
  const currentImage = currentColorData?.colorImageUrl ?? product.imageUrl;

  // Sizes filtered by selected color
  const sizesForColor = variants
    .filter((v) => (selectedColor ? v.color === selectedColor : true))
    .reduce<Variant[]>((acc, v) => {
      if (!acc.find((x) => x.size === v.size)) acc.push(v);
      return acc;
    }, []);

  const selectedVariant = selectedSize
    ? variants.find(
        (v) =>
          v.size === selectedSize &&
          (selectedColor ? v.color === selectedColor : true)
      )
    : null;

  const outOfStock =
    selectedVariant !== null && selectedVariant?.stock !== null && selectedVariant!.stock <= 0;
  const needsSize = sizesForColor.length > 0 && !selectedSize;
  const canAdd = !needsSize && !outOfStock && !!selectedVariant;

  // Preço reativo (fonte única): variante com preço próprio sobrepõe o preço do
  // produto (inclusive promoção); senão usa o preço atual do produto.
  const effectivePriceCents = selectedVariant?.priceCents ?? product.displayPriceCents;
  const originalCents = product.priceCents;
  const showStrike = effectivePriceCents < originalCents;

  function doAdd() {
    if (!canAdd || !selectedVariant) return;
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      imageUrl: currentImage,
      priceCents: effectivePriceCents,
      variantId: selectedVariant.id,
      color: selectedColor,
      size: selectedSize,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  function handleBuyNow() {
    if (!canAdd) return;
    doAdd();
    router.push("/checkout/produtos?step=dados");
  }

  return (
    <div className="flex flex-col md:flex-row gap-10">
      {/* Image — muda com a cor selecionada */}
      <div className="md:w-1/2">
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-secondary">
          {currentImage ? (
            <Image
              src={currentImage}
              alt={`${product.name}${selectedColor ? ` — ${selectedColor}` : ""}`}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover transition-opacity duration-300"
              priority
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="font-[family-name:var(--font-bebas-neue)] text-6xl text-muted-foreground">
                MEC
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Seletores + botões */}
      <div className="md:w-1/2 flex flex-col justify-center gap-5">
        {/* Preço — fonte única, reativo à variante; original cortado quando há desconto */}
        <div className="flex items-baseline gap-3 flex-wrap">
          <p className="text-3xl font-bold text-primary">{formatPrice(effectivePriceCents)}</p>
          {showStrike && (
            <>
              <p className="text-xl text-muted-foreground line-through">{formatPrice(originalCents)}</p>
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full uppercase">
                Promoção
              </span>
            </>
          )}
        </div>

        {/* Color selector */}
        {colors.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Cor:{" "}
              <span className="text-foreground font-semibold">{selectedColor ?? ""}</span>
            </p>
            <div className="flex gap-2 flex-wrap">
              {colors.map((c) => (
                <button
                  key={c.color}
                  onClick={() => {
                    setSelectedColor(c.color);
                    setSelectedSize(null);
                  }}
                  title={c.color}
                  className={`relative w-11 h-11 rounded-lg overflow-hidden border-2 transition-all ${
                    selectedColor === c.color
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/60"
                  }`}
                >
                  {c.colorImageUrl ? (
                    <Image
                      src={c.colorImageUrl}
                      alt={c.color}
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex items-center justify-center h-full text-[10px] font-bold text-muted-foreground">
                      {c.color.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Size selector */}
        {sizesForColor.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Tamanho</p>
            <div className="flex flex-wrap gap-2">
              {sizesForColor.map((v) => {
                const soldOut = v.stock !== null && v.stock <= 0;
                return (
                  <button
                    key={v.size}
                    onClick={() => !soldOut && setSelectedSize(v.size)}
                    disabled={soldOut}
                    className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                      v.size === selectedSize
                        ? "bg-primary text-primary-foreground border-primary"
                        : soldOut
                        ? "border-border text-muted-foreground opacity-40 cursor-not-allowed line-through"
                        : "border-border text-foreground hover:border-primary hover:text-primary"
                    }`}
                  >
                    {v.size}
                  </button>
                );
              })}
            </div>
            {needsSize && (
              <p className="text-xs text-destructive mt-1">Selecione um tamanho</p>
            )}
          </div>
        )}

        {outOfStock && (
          <p className="text-sm text-destructive font-semibold">Esgotado nesta combinação</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={doAdd}
            disabled={!canAdd}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-secondary text-foreground font-[family-name:var(--font-bebas-neue)] text-lg rounded-md hover:bg-secondary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {added ? <Check size={18} className="text-primary" /> : <ShoppingCart size={18} />}
            {added ? "Adicionado!" : "Adicionar ao Carrinho"}
          </button>
          <button
            onClick={handleBuyNow}
            disabled={!canAdd}
            className="flex-1 py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-lg rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Comprar Agora
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Retirada presencial — entraremos em contato via WhatsApp para combinar.
        </p>
      </div>
    </div>
  );
}
