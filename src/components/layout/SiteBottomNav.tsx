"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, ShoppingCart } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { CART_OPEN_EVENT } from "@/components/ui/CartDrawer";
import { cn } from "@/lib/utils";

function InstagramIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Bottom nav flutuante do site (torcedor) — só mobile/tablet (lg:hidden).
 * Reúne as três ações utilitárias que antes ficavam como ícones soltos no
 * topo (Pedidos, Carrinho, Instagram), agora com rótulo, para ficarem fáceis
 * de achar. No desktop essas ações continuam no header.
 */
/** Fluxos de compra focados que já têm CTA fixo no rodapé — o bottom nav some
 *  neles pra não tampar o botão de compra (e por ser ruído no checkout). */
const HIDE_ON_PREFIXES = ["/ingresso", "/checkout", "/cantina"];

export function SiteBottomNav({ instagram }: { instagram?: string | null }) {
  const pathname = usePathname();
  const { totalItems } = useCart();

  const hidden = HIDE_ON_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (hidden) return null;

  const itemBase =
    "flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors";

  const pedidosActive = pathname === "/pedidos" || pathname.startsWith("/pedidos/");

  return (
    <nav
      aria-label="Ações rápidas"
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pointer-events-none"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      <div className="pointer-events-auto w-full max-w-sm flex items-stretch rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-lg shadow-black/20">
        <Link
          href="/pedidos"
          className={cn(itemBase, "rounded-l-2xl", pedidosActive ? "text-primary" : "text-muted-foreground hover:text-foreground")}
        >
          <Package size={22} />
          <span>Pedidos</span>
        </Link>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(CART_OPEN_EVENT))}
          aria-label={`Carrinho${totalItems > 0 ? ` — ${totalItems} ${totalItems === 1 ? "item" : "itens"}` : ""}`}
          className={cn(
            itemBase,
            "text-muted-foreground hover:text-foreground border-l border-border/60",
            instagram ? "border-r" : "rounded-r-2xl"
          )}
        >
          <span className="relative">
            <ShoppingCart size={22} />
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-0.5 leading-none">
                {totalItems > 99 ? "99+" : totalItems}
              </span>
            )}
          </span>
          <span>Carrinho</span>
        </button>

        {instagram && (
          <a
            href={instagram}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(itemBase, "rounded-r-2xl text-muted-foreground hover:text-foreground")}
          >
            <InstagramIcon size={22} />
            <span>Instagram</span>
          </a>
        )}
      </div>
    </nav>
  );
}
