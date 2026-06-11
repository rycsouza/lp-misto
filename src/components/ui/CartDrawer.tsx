"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/hooks/useCart";

export const CART_OPEN_EVENT = "misto_cart_open";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const { items, removeItem, updateQuantity, totalCents, totalItems } = useCart();
  const router = useRouter();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const openDrawer = () => setOpen(true);
    window.addEventListener(CART_OPEN_EVENT, openDrawer);
    return () => window.removeEventListener(CART_OPEN_EVENT, openDrawer);
  }, []);

  // Fecha com Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Trava scroll do body quando aberto
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function handleCheckout() {
    setOpen(false);
    router.push("/checkout/produtos?step=dados");
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Carrinho de compras"
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-background border-l border-border flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingBag size={20} className="text-primary" />
            <h2 className="font-[family-name:var(--font-bebas-neue)] text-xl text-foreground">
              Carrinho
            </h2>
            {totalItems > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {totalItems}
              </span>
            )}
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar carrinho"
            className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <ShoppingBag size={48} className="text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">Seu carrinho está vazio.</p>
              <button
                onClick={() => setOpen(false)}
                className="mt-2 text-sm text-primary hover:underline"
              >
                Ver produtos
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => {
                const key = `${item.productId}__${item.variantId ?? ""}`;
                return (
                  <li
                    key={key}
                    className="flex items-center gap-3 p-3 bg-secondary/40 rounded-xl border border-border"
                  >
                    {/* Thumb */}
                    <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-secondary">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <span className="font-[family-name:var(--font-bebas-neue)] text-base text-muted-foreground">
                            MEC
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-tight line-clamp-1">
                        {item.name}
                      </p>
                      {(item.color || item.size) && (
                        <p className="text-xs text-muted-foreground">
                          {[item.color, item.size ? `Tam. ${item.size}` : null].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <p className="text-xs text-primary font-bold mt-0.5">
                        {formatPrice(item.priceCents)}
                      </p>
                    </div>

                    {/* Qty + Remove */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-secondary hover:bg-border transition-colors"
                        aria-label="Diminuir"
                      >
                        <Minus size={10} />
                      </button>
                      <span className="w-5 text-center text-sm font-bold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-secondary hover:bg-border transition-colors"
                        aria-label="Aumentar"
                      >
                        <Plus size={10} />
                      </button>
                      <button
                        onClick={() => removeItem(item.productId, item.variantId)}
                        className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors ml-1"
                        aria-label="Remover"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-5 py-4 border-t border-border shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-bold text-primary">{formatPrice(totalCents)}</span>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors"
            >
              Finalizar Compra
            </button>
            <button
              onClick={() => setOpen(false)}
              className="w-full py-2.5 bg-secondary text-foreground text-sm font-semibold rounded-md hover:bg-secondary/80 transition-colors"
            >
              Continuar Comprando
            </button>
          </div>
        )}
      </div>
    </>
  );
}
