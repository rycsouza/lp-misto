"use client";

import { useState } from "react";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

// ─── Gráfico de receita diária (barras interativas) ──────────────────────────

interface DailyPoint {
  date: string;
  cents: number;
}

export function DailyRevenueChart({ data }: { data: DailyPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Sem vendas no período selecionado.
      </p>
    );
  }

  const max = Math.max(1, ...data.map((d) => d.cents));
  const total = data.reduce((s, d) => s + d.cents, 0);
  // Mostra no máximo ~10 rótulos no eixo X para não sobrepor
  const labelStep = Math.ceil(data.length / 10);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
        <span>
          Total: <span className="text-foreground font-semibold">{formatCurrency(total)}</span>
        </span>
        <span>Máx/dia: {formatCurrency(max)}</span>
      </div>

      <div className="flex items-end gap-1 h-40 overflow-x-auto pt-8">
        {data.map((d, i) => {
          const isHover = hover === i;
          const heightPct = Math.max(d.cents > 0 ? 4 : 1, (d.cents / max) * 100);
          return (
            <div
              key={`${d.date}-${i}`}
              className="relative flex flex-col items-center gap-1 flex-1 min-w-[20px] h-full justify-end cursor-default"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
            >
              {/* Tooltip */}
              {isHover && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-md bg-popover border border-border px-2.5 py-1.5 shadow-lg pointer-events-none">
                  <p className="text-[10px] text-muted-foreground leading-tight">{d.date}</p>
                  <p className="text-xs font-semibold text-foreground leading-tight">
                    {formatCurrency(d.cents)}
                  </p>
                </div>
              )}
              <div className="w-full flex items-end h-32">
                <div
                  className={`w-full rounded-t transition-colors ${
                    isHover ? "bg-primary" : "bg-primary/70"
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span
                className={`text-[9px] whitespace-nowrap transition-colors ${
                  isHover ? "text-foreground font-medium" : "text-muted-foreground"
                }`}
              >
                {i % labelStep === 0 ? d.date : " "}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Receita por categoria (barras proporcionais interativas) ────────────────

interface CategoryItem {
  label: string;
  cents: number;
}

export function CategoryBreakdown({ items }: { items: CategoryItem[] }) {
  const [hover, setHover] = useState<number | null>(null);
  // Proporção calculada sobre a maior receita positiva (descontos ficam negativos)
  const maxPositive = Math.max(1, ...items.map((i) => Math.max(0, i.cents)));
  const grossPositive = items.reduce((s, i) => s + Math.max(0, i.cents), 0);

  return (
    <div className="flex flex-col gap-3">
      {items.map((c, i) => {
        const isNeg = c.cents < 0;
        const widthPct = isNeg ? 100 : (c.cents / maxPositive) * 100;
        const share =
          !isNeg && grossPositive > 0 ? Math.round((c.cents / grossPositive) * 100) : null;
        return (
          <div
            key={c.label}
            className="flex flex-col gap-1 rounded-lg px-2 -mx-2 py-1.5 transition-colors hover:bg-secondary/40"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {c.label}
                {share != null && (
                  <span
                    className={`ml-2 text-xs transition-opacity ${
                      hover === i ? "opacity-100 text-primary" : "opacity-0"
                    }`}
                  >
                    {share}%
                  </span>
                )}
              </span>
              <span
                className={`text-sm font-semibold ${
                  isNeg ? "text-amber-500" : "text-foreground"
                }`}
              >
                {formatCurrency(c.cents)}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-secondary/50 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isNeg ? "bg-amber-500/60" : hover === i ? "bg-primary" : "bg-primary/60"
                }`}
                style={{ width: `${Math.max(2, Math.abs(widthPct))}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
