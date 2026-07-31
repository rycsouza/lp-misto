"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, ShoppingCart, FileText, MoreHorizontal } from "lucide-react";
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
 * Ações utilitárias com rótulo (Pedidos, Carrinho, Instagram). Itens secundários
 * (ex.: Prestação de Contas) ficam atrás de um botão "Mais", para não poluir a
 * barra nem exibir rótulos ambíguos soltos. No desktop tudo vive no header.
 */
/** Fluxos de compra focados que já têm CTA fixo no rodapé — o bottom nav some
 *  neles pra não tampar o botão de compra (e por ser ruído no checkout). */
const HIDE_ON_PREFIXES = ["/ingresso", "/checkout", "/cantina", "/sorteio"];

export function SiteBottomNav({
  instagram,
  hasAccountability = false,
}: {
  instagram?: string | null;
  hasAccountability?: boolean;
}) {
  const pathname = usePathname();
  const { totalItems } = useCart();
  const [moreOpen, setMoreOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  // Fecha o "Mais" ao clicar fora, no Escape, ou ao trocar de rota.
  useEffect(() => {
    if (!moreOpen) return;
    function onDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  useEffect(() => setMoreOpen(false), [pathname]);

  const hidden = HIDE_ON_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (hidden) return null;

  const itemBase =
    "flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors";

  const pedidosActive = pathname === "/pedidos" || pathname.startsWith("/pedidos/");

  // Itens secundários que vão para o menu "Mais".
  const hasMore = hasAccountability || !!instagram;

  return (
    <nav
      ref={rootRef}
      aria-label="Ações rápidas"
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pointer-events-none"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      {/* Wrapper relativo SEM overflow — ancora o popover acima da barra. */}
      <div className="pointer-events-auto w-full max-w-sm relative">
        {/* Popover do "Mais" */}
        {moreOpen && hasMore && (
          <div className="absolute bottom-full right-0 mb-2 min-w-[210px] rounded-xl border border-border bg-card shadow-lg shadow-black/30 p-1">
            {hasAccountability && (
              <Link
                href="/#prestacao-contas"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
              >
                <FileText size={17} className="text-primary shrink-0" />
                Prestação de Contas
              </Link>
            )}
            {instagram && (
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
              >
                <InstagramIcon size={17} />
                Instagram
              </a>
            )}
          </div>
        )}

        {/* Barra — cantos/divisórias via seletor de filhos (robusto ao nº de itens). */}
        <div className="flex items-stretch rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-lg shadow-black/20 overflow-hidden [&>*+*]:border-l [&>*+*]:border-border/60">
          <Link
            href="/pedidos"
            className={cn(itemBase, pedidosActive ? "text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            <Package size={22} />
            <span>Pedidos</span>
          </Link>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(CART_OPEN_EVENT))}
            aria-label={`Carrinho${totalItems > 0 ? ` — ${totalItems} ${totalItems === 1 ? "item" : "itens"}` : ""}`}
            className={cn(itemBase, "text-muted-foreground hover:text-foreground")}
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

          {hasMore && (
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              aria-label="Mais opções"
              className={cn(itemBase, moreOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <MoreHorizontal size={22} />
              <span>Mais</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
