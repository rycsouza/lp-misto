"use client";

import Link from "next/link";

export default function MobileStickyCTA() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-sm border-t border-border p-3 flex gap-3">
      <a
        href="#socio"
        className="flex-1 text-center py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-lg rounded-md hover:bg-primary/90 transition-colors"
      >
        Seja Sócio
      </a>
      <Link
        href="/ingresso"
        className="flex-1 text-center py-3 bg-secondary text-foreground font-[family-name:var(--font-bebas-neue)] text-lg rounded-md hover:bg-secondary/80 transition-colors"
      >
        Ingressos
      </Link>
    </div>
  );
}
