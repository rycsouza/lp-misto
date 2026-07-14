"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ReportSection {
  key: string;
  label: string;
  content: ReactNode;
}

/**
 * Sub-abas do relatório de vendas. O conteúdo de cada seção é renderizado no
 * servidor e passado como slot — aqui só alternamos a visibilidade (sem recarregar
 * a página nem refazer a query). Tudo fica montado, então gráficos preservam estado.
 *
 * Visual deliberadamente mais leve que as abas de topo (Vendas/Pós-jogo): pílula
 * com fundo de card, para deixar clara a hierarquia (aba principal > seção).
 */
export function ReportSectionTabs({ sections }: { sections: ReportSection[] }) {
  const [active, setActive] = useState(sections[0]?.key ?? "");

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Seções do relatório"
        className="flex gap-1 p-1 bg-secondary/40 border border-border rounded-xl overflow-x-auto"
      >
        {sections.map((s) => {
          const isActive = active === s.key;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(s.key)}
              className={cn(
                "flex-1 whitespace-nowrap px-4 py-2.5 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {sections.map((s) => (
        <div key={s.key} role="tabpanel" hidden={active !== s.key}>
          {active === s.key && s.content}
        </div>
      ))}
    </div>
  );
}
