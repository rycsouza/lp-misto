"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Recolhe o bloco de filtros no mobile (fica atrás de um botão "Filtros"),
 * para a lista não começar 7 controles abaixo do topo. No desktop (sm+) os
 * filtros ficam sempre visíveis — o botão some. Abre por padrão quando já há
 * filtro aplicado, para o operador ver o que está filtrando.
 */
export function CollapsibleFilters({
  activeCount,
  children,
}: {
  activeCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(activeCount > 0);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="sm:hidden flex items-center justify-between gap-2 bg-card border border-border rounded-lg px-4 py-2.5 text-sm font-medium text-foreground"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-muted-foreground" />
          Filtros
          {activeCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs font-semibold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={cn("text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      <div className={cn(open ? "block" : "hidden", "sm:block")}>{children}</div>
    </div>
  );
}
