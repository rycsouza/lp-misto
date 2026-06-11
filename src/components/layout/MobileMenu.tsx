"use client";

import { useState, useEffect } from "react";
import { Menu, X, ChevronRight, Package } from "lucide-react";
import Link from "next/link";

interface NavLink {
  href: string;
  label: string;
}

interface MobileMenuProps {
  links: NavLink[];
}

export default function MobileMenu({ links }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  // Trava o scroll do body quando o menu está aberto
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Separa links de seção (/#ancora) dos links de página (/rota)
  const sectionLinks = links.filter((l) => l.href.startsWith("/#"));
  const pageLinks    = links.filter((l) => !l.href.startsWith("/#"));

  function close() { setOpen(false); }

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md"
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Overlay sempre no DOM — transição CSS funciona nas duas direções */}
      <div
        aria-hidden={!open}
        className={`fixed inset-0 top-16 z-50 bg-background flex flex-col transition-all duration-300 ease-in-out ${
          open ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        {/* Lista principal — scrollável */}
        <nav className="flex-1 overflow-y-auto px-6 pt-4 pb-6" aria-label="Menu mobile">
          {sectionLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={close}
              className="flex items-center justify-between py-4 border-b border-border/40 group"
            >
              <span className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground group-hover:text-primary transition-colors">
                {link.label}
              </span>
              <ChevronRight
                size={18}
                className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all"
              />
            </a>
          ))}
        </nav>

        {/* Links de página (Meus Pedidos, etc.) — separados na parte inferior */}
        {pageLinks.length > 0 && (
          <div className="px-6 py-4 border-t border-border bg-card/30">
            {pageLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className="flex items-center gap-3 py-3 text-muted-foreground hover:text-foreground transition-colors group"
              >
                <Package size={16} className="shrink-0 group-hover:text-primary transition-colors" />
                <span className="font-[family-name:var(--font-bebas-neue)] text-xl">
                  {link.label}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
