"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { CART_OPEN_EVENT } from "./CartDrawer";

export function CartIcon() {
  const { totalItems } = useCart();

  function handleClick() {
    window.dispatchEvent(new Event(CART_OPEN_EVENT));
  }

  return (
    <button
      onClick={handleClick}
      aria-label={`Carrinho${totalItems > 0 ? ` — ${totalItems} ${totalItems === 1 ? "item" : "itens"}` : ""}`}
      className="relative text-muted-foreground hover:text-primary transition-colors"
    >
      <ShoppingCart size={20} />
      {totalItems > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-0.5 leading-none">
          {totalItems > 99 ? "99+" : totalItems}
        </span>
      )}
    </button>
  );
}
