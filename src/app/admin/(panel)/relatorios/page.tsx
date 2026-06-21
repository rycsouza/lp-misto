import { getSalesReport } from "@/app/actions/admin";
import { TrendingUp, ShoppingCart, Ticket, Receipt } from "lucide-react";
import {
  DailyRevenueChart,
  CategoryBreakdown,
} from "@/components/admin/SalesReportCharts";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

const STATUS_LABELS: Record<string, string> = {
  paid: "Pagos",
  pending: "Pendentes",
  cancelled: "Cancelados",
  refunded: "Reembolsados",
};

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function RelatoriosPage({ searchParams }: PageProps) {
  const { from, to } = await searchParams;
  const report = await getSalesReport({ from, to });

  const kpis = [
    {
      label: "Receita no período",
      value: formatCurrency(report.revenueCents),
      icon: TrendingUp,
      accent: "text-green-600",
    },
    {
      label: "Pedidos pagos",
      value: String(report.paidOrders),
      icon: ShoppingCart,
      accent: "text-foreground",
    },
    {
      label: "Ticket médio",
      value: formatCurrency(report.avgTicketCents),
      icon: Receipt,
      accent: "text-foreground",
    },
    {
      label: "Ingressos vendidos",
      value: String(report.ticketsSold),
      icon: Ticket,
      accent: "text-foreground",
    },
  ];

  const categories = [
    { label: "Ingressos", cents: report.ticketRevenueCents },
    { label: "Produtos", cents: report.productRevenueCents },
    { label: "Descontos aplicados", cents: report.discountsCents },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-xl text-foreground tracking-wide">
          RELATÓRIO DE VENDAS
        </h2>

        {/* Filtro de período (GET) */}
        <form className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="from" className="text-xs text-muted-foreground block mb-1">
              De
            </label>
            <input
              type="date"
              id="from"
              name="from"
              defaultValue={report.range.from}
              className="bg-input border border-border rounded-md px-3 py-1.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="to" className="text-xs text-muted-foreground block mb-1">
              Até
            </label>
            <input
              type="date"
              id="to"
              name="to"
              defaultValue={report.range.to}
              className="bg-input border border-border rounded-md px-3 py-1.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            className="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Aplicar
          </button>
        </form>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {k.label}
                </p>
                <Icon size={15} className="text-muted-foreground/60" />
              </div>
              <p className={`text-lg sm:text-2xl font-bold ${k.accent}`}>{k.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receita por categoria */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4">Receita por categoria</h3>
          <CategoryBreakdown items={categories} />
        </div>

        {/* Ingressos por tipo + pedidos por status */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-5">
          <div>
            <h3 className="font-semibold text-foreground mb-3">Ingressos por tipo</h3>
            {report.byTicketType.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum ingresso vendido no período.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                {report.byTicketType.map((t) => (
                  <div key={t.label} className="bg-secondary/40 rounded-lg py-3 px-2">
                    <p className="text-2xl font-bold text-foreground">{t.qty}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-3">Pedidos por status</h3>
            <div className="flex flex-wrap gap-2">
              {report.ordersByStatus.length === 0 && (
                <span className="text-sm text-muted-foreground">Nenhum pedido no período.</span>
              )}
              {report.ordersByStatus.map((s) => (
                <span
                  key={s.status}
                  className="text-xs bg-secondary text-foreground rounded-full px-3 py-1"
                >
                  {STATUS_LABELS[s.status] ?? s.status}: <b>{s.total}</b>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Receita diária */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-4">Receita diária (pagos)</h3>
        <DailyRevenueChart data={report.dailyRevenue} />
      </div>

      {/* Vendas por jogo */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <h3 className="font-semibold text-foreground px-5 py-3 border-b border-border">
          Vendas de ingressos por jogo
        </h3>
        {report.byGame.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum ingresso vendido no período.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30 text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-5 py-2.5">Jogo</th>
                <th className="text-right px-5 py-2.5">Qtd.</th>
                <th className="text-right px-5 py-2.5">Receita</th>
              </tr>
            </thead>
            <tbody>
              {report.byGame.map((g) => (
                <tr
                  key={g.label}
                  className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-5 py-2.5 text-foreground">{g.label}</td>
                  <td className="px-5 py-2.5 text-right text-muted-foreground">{g.qty}</td>
                  <td className="px-5 py-2.5 text-right font-semibold text-foreground">
                    {formatCurrency(g.cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Top produtos */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <h3 className="font-semibold text-foreground px-5 py-3 border-b border-border">
          Produtos mais vendidos
        </h3>
        {report.topProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum produto vendido no período.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30 text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-5 py-2.5">Produto</th>
                <th className="text-right px-5 py-2.5">Qtd.</th>
                <th className="text-right px-5 py-2.5">Receita</th>
              </tr>
            </thead>
            <tbody>
              {report.topProducts.map((p) => (
                <tr
                  key={p.label}
                  className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-5 py-2.5 text-foreground">{p.label}</td>
                  <td className="px-5 py-2.5 text-right text-muted-foreground">{p.qty}</td>
                  <td className="px-5 py-2.5 text-right font-semibold text-foreground">
                    {formatCurrency(p.cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
