"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

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
  const active = hover != null ? data[hover] : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
        <span>
          Total: <span className="text-foreground font-semibold">{formatCurrency(total)}</span>
        </span>
        {active ? (
          <span className="text-foreground whitespace-nowrap">
            {active.date}:{" "}
            <span className="text-primary font-semibold">{formatCurrency(active.cents)}</span>
          </span>
        ) : (
          <span className="whitespace-nowrap">Máx/dia: {formatCurrency(max)}</span>
        )}
      </div>

      <div className="flex items-end gap-1 h-40 overflow-x-auto">
        {data.map((d, i) => {
          const isHover = hover === i;
          const heightPct = Math.max(d.cents > 0 ? 4 : 1, (d.cents / max) * 100);
          return (
            <div
              key={`${d.date}-${i}`}
              className="flex flex-col items-center gap-1 flex-1 min-w-[20px] h-full justify-end cursor-default"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
            >
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

// ─── Vendas por variante (acordeão por produto) ──────────────────────────────

interface VariantRow {
  product: string;
  color: string | null;
  size: string | null;
  qty: number;
}

interface VariantGroup {
  product: string;
  total: number;
  rows: VariantRow[];
}

export function ProductVariantBreakdown({ groups }: { groups: VariantGroup[] }) {
  // Mantém o relatório visualmente limpo: tudo fechado por padrão, abre ao clicar.
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Nenhum produto vendido no período.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {groups.map((group) => {
        const isOpen = open[group.product] ?? false;
        return (
          <div key={group.product} className="border-b border-border last:border-0">
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [group.product]: !isOpen }))}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-secondary/30 transition-colors"
            >
              <span className="flex items-center gap-2 min-w-0">
                <ChevronRight
                  size={16}
                  className={`shrink-0 text-muted-foreground transition-transform ${
                    isOpen ? "rotate-90" : ""
                  }`}
                />
                <span className="font-semibold text-foreground text-sm truncate">
                  {group.product}
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                <b className="text-foreground">{group.total}</b> un.
              </span>
            </button>

            {isOpen && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border/50 text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="text-left px-5 py-2 pl-11">Cor</th>
                    <th className="text-left px-5 py-2">Tamanho</th>
                    <th className="text-right px-5 py-2">Qtd.</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((r, i) => (
                    <tr
                      key={`${r.color ?? "-"}-${r.size ?? "-"}-${i}`}
                      className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors"
                    >
                      <td className="px-5 py-2 pl-11 text-foreground">{r.color ?? "—"}</td>
                      <td className="px-5 py-2 text-foreground">{r.size ?? "—"}</td>
                      <td className="px-5 py-2 text-right font-semibold text-foreground">
                        {r.qty}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
