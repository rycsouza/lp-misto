import { getAdminStats, getAdminOrders } from "@/app/actions/admin";
import { OrderExpiryWatcher } from "@/components/admin/OrderExpiryWatcher";
import { PaymentReconciler } from "@/components/admin/PaymentReconciler";
import { StatusBadge } from "@/components/admin/StatusBadge";
import Link from "next/link";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function toWaLink(raw: string) {
  const d = raw.replace(/\D/g, "");
  return `https://wa.me/${d.startsWith("55") ? d : `55${d}`}`;
}

export default async function DashboardPage() {
  const [stats, { rows: recentOrders }] = await Promise.all([
    getAdminStats(),
    getAdminOrders({ page: 1, limit: 3 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <OrderExpiryWatcher />
      <PaymentReconciler />
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
            <p className="text-lg sm:text-2xl font-bold text-foreground">
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
            <p className="text-lg sm:text-2xl font-bold text-foreground">
              {formatCurrency(stats.membershipMRRCents)}
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Comissões Pendentes
            </p>
            <p className="text-lg sm:text-2xl font-bold text-amber-500">
              {formatCurrency(stats.affiliatePendingCommissionCents)}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-display text-lg text-foreground tracking-wide">
            ÚLTIMOS PEDIDOS
          </h2>
          <Link href="/admin/pedidos" className="text-sm text-primary hover:underline">
            Ver todos
          </Link>
        </div>

        <div className="divide-y divide-border/50">
          {recentOrders.length === 0 && (
            <p className="text-center text-muted-foreground py-10 text-sm">
              Nenhum pedido encontrado
            </p>
          )}
          {recentOrders.map((order) => (
            <div key={order.id} className="px-4 py-3 flex flex-col gap-1.5 hover:bg-secondary/20 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <span className="text-foreground font-medium text-sm">{order.customerName}</span>
                <StatusBadge status={order.displayStatus} />
              </div>
              <div className="flex items-center justify-between">
                <a
                  href={toWaLink(order.customerWhatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground text-xs hover:text-green-500 transition-colors"
                >
                  {order.customerWhatsapp}
                </a>
                <span className="font-semibold text-foreground text-sm">
                  {formatCurrency(order.totalCents)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">
                  {order.gatewaySlug?.toUpperCase() ?? "—"} · {formatDate(order.createdAt)}
                </span>
                <Link href={`/admin/pedidos/${order.id}`} className="text-primary text-xs hover:underline">
                  Ver
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
