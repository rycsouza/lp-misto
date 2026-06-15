import { getAdminStats, getRecentOrders } from "@/app/actions/admin";
import { StatusBadge } from "@/components/admin/StatusBadge";
import Link from "next/link";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DashboardPage() {
  const [stats, recentOrders] = await Promise.all([
    getAdminStats(),
    getRecentOrders(10),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* Pedidos KPIs */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 px-1">
          Pedidos
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Receita Hoje
            </p>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(stats.totalRevenueTodayCents)}
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Pedidos Hoje
            </p>
            <p className="text-2xl font-bold text-foreground">
              {stats.ordersToday}
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Pedidos Pagos
            </p>
            <p className="text-2xl font-bold text-green-600">
              {stats.ordersPaid}
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Aguardando Pagamento
            </p>
            <p className="text-2xl font-bold text-amber-500">
              {stats.ordersPending}
            </p>
          </div>
        </div>
      </div>

      {/* Crescimento KPIs */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 px-1">
          Crescimento
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Sócios Ativos
            </p>
            <p className="text-2xl font-bold text-green-600">
              {stats.membersActive}
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Sócios Pendentes
            </p>
            <p className="text-2xl font-bold text-amber-500">
              {stats.membersPending}
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              MRR Sócios
            </p>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(stats.membershipMRRCents)}
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Comissões Pendentes
            </p>
            <p className="text-2xl font-bold text-amber-500">
              {formatCurrency(stats.affiliatePendingCommissionCents)}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-foreground tracking-wide">
            ÚLTIMOS PEDIDOS
          </h2>
          <Link
            href="/admin/pedidos"
            className="text-sm text-primary hover:underline"
          >
            Ver todos
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider py-2 pr-4">
                  Nome
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider py-2 pr-4">
                  Email
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider py-2 pr-4">
                  Total
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider py-2 pr-4">
                  Método
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider py-2 pr-4">
                  Status
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider py-2 pr-4">
                  Data
                </th>
                <th className="text-right text-muted-foreground text-xs uppercase tracking-wider py-2">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    Nenhum pedido encontrado
                  </td>
                </tr>
              )}
              {recentOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  <td className="py-3 pr-4 text-foreground">
                    {order.customerName}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {order.customerEmail}
                  </td>
                  <td className="py-3 pr-4 font-medium text-foreground">
                    {formatCurrency(order.totalCents)}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground uppercase text-xs">
                    {order.paymentMethod}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground text-xs">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      href={`/admin/pedidos/${order.id}`}
                      className="text-primary text-xs hover:underline"
                    >
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
