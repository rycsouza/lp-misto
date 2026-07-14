import { getSalesReport } from "@/app/actions/admin";
import { TrendingUp, ShoppingCart, Ticket, Receipt } from "lucide-react";
import Link from "next/link";
import {
  DailyRevenueChart,
  CategoryBreakdown,
  ProductVariantBreakdown,
} from "@/components/admin/SalesReportCharts";
import { ReportSectionTabs } from "@/components/admin/ReportSectionTabs";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

const STATUS_LABELS: Record<string, string> = {
  paid: "Pagos",
  pending: "Pendentes",
  cancelled: "Cancelados",
  refunded: "Reembolsados",
};

interface RankRow {
  label: string;
  qty: number;
  cents: number;
}

/**
 * Ranking (jogos/produtos) responsivo: tabela no desktop, lista de cards no
 * celular — a tabela de 3 colunas com padding de desktop espremia em 375px.
 */
function RankList({ rows, firstCol, emptyText }: { rows: RankRow[]; firstCol: string; emptyText: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{emptyText}</p>;
  }
  return (
    <>
      {/* Mobile: cards */}
      <ul className="sm:hidden divide-y divide-border/50">
        {rows.map((r) => (
          <li key={r.label} className="px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-foreground text-sm min-w-0 break-words">{r.label}</span>
            <span className="shrink-0 text-right">
              <span className="block font-semibold text-foreground text-sm tabular-nums">
                {formatCurrency(r.cents)}
              </span>
              <span className="block text-xs text-muted-foreground tabular-nums">{r.qty} un.</span>
            </span>
          </li>
        ))}
      </ul>

      {/* Desktop: tabela */}
      <table className="hidden sm:table w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/30 text-xs text-muted-foreground uppercase tracking-wider">
            <th className="text-left px-5 py-2.5">{firstCol}</th>
            <th className="text-right px-5 py-2.5">Qtd.</th>
            <th className="text-right px-5 py-2.5">Receita</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.label}
              className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors"
            >
              <td className="px-5 py-2.5 text-foreground">{r.label}</td>
              <td className="px-5 py-2.5 text-right text-muted-foreground tabular-nums">{r.qty}</td>
              <td className="px-5 py-2.5 text-right font-semibold text-foreground tabular-nums">
                {formatCurrency(r.cents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

interface SalesReportProps {
  from?: string;
  to?: string;
  cortesia?: string;
}

/** Relatório de vendas — filtro por período. Aba "Vendas" da tela de relatórios. */
export async function SalesReport({ from, to, cortesia }: SalesReportProps) {
  const showCourtesy = cortesia === "1";
  const report = await getSalesReport({ from, to, excludeCourtesy: !showCourtesy });

  // Preserva o período ao alternar a exibição de cortesias (fica na aba Vendas).
  function courtesyToggleHref(next: boolean): string {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (next) p.set("cortesia", "1");
    const qs = p.toString();
    return `/admin/relatorios${qs ? `?${qs}` : ""}`;
  }

  const kpis = [
    { label: "Receita no período", value: formatCurrency(report.revenueCents), icon: TrendingUp, accent: "text-green-500" },
    { label: "Pedidos pagos", value: String(report.paidOrders), icon: ShoppingCart, accent: "text-foreground" },
    { label: "Ticket médio", value: formatCurrency(report.avgTicketCents), icon: Receipt, accent: "text-foreground" },
    { label: "Ingressos vendidos", value: String(report.ticketsSold), icon: Ticket, accent: "text-foreground" },
  ];

  // Agrupa o detalhamento de variantes por produto (para o pedido ao fabricante)
  type VariantRow = (typeof report.productVariants)[number];
  const variantGroups = Object.values(
    report.productVariants.reduce(
      (acc, r) => {
        (acc[r.product] ??= { product: r.product, total: 0, rows: [] }).rows.push(r);
        acc[r.product].total += r.qty;
        return acc;
      },
      {} as Record<string, { product: string; total: number; rows: VariantRow[] }>
    )
  );

  const categories = [
    { label: "Ingressos", cents: report.ticketRevenueCents },
    { label: "Produtos", cents: report.productRevenueCents },
    ...(report.raffleRevenueCents > 0 ? [{ label: "Rifas", cents: report.raffleRevenueCents }] : []),
    { label: "Descontos aplicados", cents: report.discountsCents },
    ...(report.shippingCents > 0 ? [{ label: "Frete", cents: report.shippingCents }] : []),
    ...(report.unclassifiedCents !== 0
      ? [{ label: "Não classificado (a investigar)", cents: report.unclassifiedCents }]
      : []),
  ];

  // "Pedidos pagos" já é KPI de destaque; aqui mostramos só o restante da
  // composição (reembolsados/cancelados/pendentes) para não repetir o número.
  const otherStatuses = report.ordersByStatus.filter((s) => s.status !== "paid");

  const overview = (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receita por categoria */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4">Receita por categoria</h3>
          <CategoryBreakdown items={categories} />
        </div>

        {/* Ingressos por tipo + demais status */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-5">
          <div>
            <h3 className="font-semibold text-foreground mb-3">Ingressos por tipo</h3>
            {report.byTicketType.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum ingresso vendido no período.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                {report.byTicketType.map((t) => (
                  <div key={t.label} className="bg-secondary/40 rounded-lg py-3 px-2">
                    <p className="text-2xl font-bold text-foreground tabular-nums">{t.qty}</p>
                    <p className="text-xs text-muted-foreground break-words">{t.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          {otherStatuses.length > 0 && (
            <div>
              <h3 className="font-semibold text-foreground mb-3">Outros status de pedido</h3>
              <div className="flex flex-wrap gap-2">
                {otherStatuses.map((s) => (
                  <span
                    key={s.status}
                    className="text-xs bg-secondary text-foreground rounded-full px-3 py-1"
                  >
                    {STATUS_LABELS[s.status] ?? s.status}: <b>{s.total}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Receita diária */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-4">Receita diária (pagos)</h3>
        <DailyRevenueChart data={report.dailyRevenue} />
      </div>
    </div>
  );

  const byGameSection = (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <h3 className="font-semibold text-foreground px-5 py-3 border-b border-border">
        Vendas de ingressos por jogo
      </h3>
      <RankList rows={report.byGame} firstCol="Jogo" emptyText="Nenhum ingresso vendido no período." />
    </div>
  );

  const productsSection = (
    <div className="flex flex-col gap-6">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <h3 className="font-semibold text-foreground px-5 py-3 border-b border-border">
          Produtos mais vendidos
        </h3>
        <RankList rows={report.topProducts} firstCol="Produto" emptyText="Nenhum produto vendido no período." />
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <h3 className="font-semibold text-foreground px-5 py-3 border-b border-border">
          Vendas por variante (cor / tamanho)
        </h3>
        <ProductVariantBreakdown groups={variantGroups} />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Filtro de período + cortesias */}
      <div className="flex flex-col gap-3 bg-card border border-border rounded-xl p-4">
        <form className="flex flex-wrap items-end gap-2">
          {showCourtesy && <input type="hidden" name="cortesia" value="1" />}
          <div className="flex-1 min-w-[130px]">
            <label htmlFor="from" className="text-xs text-muted-foreground block mb-1">
              De
            </label>
            <input
              type="date"
              id="from"
              name="from"
              defaultValue={report.range.from}
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex-1 min-w-[130px]">
            <label htmlFor="to" className="text-xs text-muted-foreground block mb-1">
              Até
            </label>
            <input
              type="date"
              id="to"
              name="to"
              defaultValue={report.range.to}
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            className="bg-primary text-primary-foreground rounded-md px-5 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Aplicar
          </button>
        </form>
        <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-3">
          <p className="text-xs text-muted-foreground">
            {showCourtesy
              ? "Incluindo cortesias gratuitas nas métricas."
              : "Cortesias gratuitas não estão sendo contabilizadas."}
          </p>
          <Link
            href={courtesyToggleHref(!showCourtesy)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              showCourtesy
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {showCourtesy ? "✕ Ocultar cortesias" : "Ver cortesias"}
          </Link>
        </div>
      </div>

      {/* KPIs — sempre visíveis */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-card border border-border rounded-xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</p>
                <Icon size={15} className="text-muted-foreground/60 shrink-0" />
              </div>
              <p className={`text-lg sm:text-2xl font-bold tabular-nums ${k.accent}`}>{k.value}</p>
            </div>
          );
        })}
      </div>

      {/* Detalhamento em sub-abas (mata o scroll) */}
      <ReportSectionTabs
        sections={[
          { key: "overview", label: "Visão geral", content: overview },
          { key: "game", label: "Por jogo", content: byGameSection },
          { key: "products", label: "Produtos", content: productsSection },
        ]}
      />
    </div>
  );
}
