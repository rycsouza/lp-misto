"use client";

import Image from "next/image";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/hooks/useCart";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

interface CartReviewProps {
  onNext: () => void;
}

export function CartReview({ onNext }: CartReviewProps) {
  const { items, removeItem, updateQuantity, totalCents } = useCart();

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingBag size={48} className="mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-sm">Seu carrinho está vazio.</p>
        <a href="/#loja" className="mt-4 inline-block text-sm text-primary hover:underline">
          Ver produtos
        </a>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-6">
        Carrinho
      </h2>

      <ul className="space-y-4 mb-6">
        {items.map((item) => {
          const key = `${item.productId}__${item.variantId ?? ""}`;
          return (
            <li key={key} className="flex items-center gap-3 p-3 bg-secondary/40 rounded-xl border border-border">
              <div className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-secondary">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.name} fill sizes="64px" className="object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="font-[family-name:var(--font-bebas-neue)] text-lg text-muted-foreground">MEC</span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight line-clamp-1">{item.name}</p>
                {(item.color || item.size) && (
                  <p className="text-xs text-muted-foreground">
                    {[item.color, item.size ? `Tam. ${item.size}` : null].filter(Boolean).join(" · ")}
                  </p>
                )}
                <p className="text-xs text-primary font-bold mt-0.5">
                  {formatPrice(item.priceCents * item.quantity)}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary hover:bg-border transition-colors"
                  aria-label="Diminuir"
                >
                  <Minus size={12} />
                </button>
                <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary hover:bg-border transition-colors"
                  aria-label="Aumentar"
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={() => removeItem(item.productId, item.variantId)}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive transition-colors ml-1"
                  aria-label="Remover"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between py-3 border-t border-border mb-6">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="text-xl font-bold text-primary">{formatPrice(totalCents)}</span>
      </div>

      <button
        onClick={onNext}
        className="w-full py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors"
      >
        Continuar
      </button>
    </div>
  );
}
