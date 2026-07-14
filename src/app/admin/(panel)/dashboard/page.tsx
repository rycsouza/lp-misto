export const dynamic = "force-dynamic";

import { getAdminStats, getAdminOrders } from "@/app/actions/admin";
import { getOnboardingStatus } from "@/app/actions/onboarding";
import { OrderExpiryWatcher } from "@/components/admin/OrderExpiryWatcher";
import { OnboardingChecklist } from "@/components/admin/OnboardingChecklist";
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

/**
 * Card de indicador. `tone` é semântico de verdade: "good"/"warn" só colorem
 * quando o valor pede atenção — 0 fica neutro (não alarma à toa). `period`
 * deixa claro o recorte de tempo (hoje/total), evitando misturar sem avisar.
 */
function KpiCard({
  label,
  value,
  period,
  tone = "neutral",
}: {
  label: string;
  value: string;
  period?: string;
  tone?: "neutral" | "good" | "warn";
}) {
  const valueColor =
    tone === "good" ? "text-green-500" : tone === "warn" ? "text-amber-500" : "text-foreground";
  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-[13px] text-muted-foreground leading-tight">{label}</p>
        {period && (
          <span className="shrink-0 text-[10px] text-muted-foreground/70 uppercase tracking-wide mt-0.5">
            {period}
          </span>
        )}
      </div>
      <p className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const [stats, { rows: recentOrders }, onboarding] = await Promise.all([
    getAdminStats(),
    getAdminOrders({ page: 1, limit: 3 }),
    getOnboardingStatus().catch(() => null),
  ]);

  // Bloco de crescimento (sócios/afiliados) só aparece se houver algum dado —
  // evita 4 cards zerados poluindo o painel de quem não usa esses módulos.
  const showGrowth =
    stats.membersActive > 0 ||
    stats.membersPending > 0 ||
    stats.membershipMRRCents > 0 ||
    stats.affiliatePendingCommissionCents > 0;

  return (
    <div className="flex flex-col gap-6">
      <OrderExpiryWatcher />
      <PaymentReconciler />
      {onboarding && !onboarding.allDone && (
        <OnboardingChecklist status={onboarding} />
      )}
      {/* Pedidos */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 px-1">
          Pedidos
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard label="Receita" period="hoje" value={formatCurrency(stats.totalRevenueTodayCents)} />
          <KpiCard label="Novos pedidos" period="hoje" value={String(stats.ordersToday)} />
          <KpiCard label="Pagos" period="total" value={String(stats.ordersPaid)} tone={stats.ordersPaid > 0 ? "good" : "neutral"} />
          <KpiCard label="Aguardando" period="total" value={String(stats.ordersPending)} tone={stats.ordersPending > 0 ? "warn" : "neutral"} />
        </div>
      </div>

      {/* Crescimento — só quando há dado de sócios/afiliados */}
      {showGrowth && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Crescimento
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard label="Sócios ativos" value={String(stats.membersActive)} tone={stats.membersActive > 0 ? "good" : "neutral"} />
            <KpiCard label="Sócios pendentes" value={String(stats.membersPending)} tone={stats.membersPending > 0 ? "warn" : "neutral"} />
            <KpiCard label="Mensalidades" period="por mês" value={formatCurrency(stats.membershipMRRCents)} />
            <KpiCard label="Comissões a pagar" value={formatCurrency(stats.affiliatePendingCommissionCents)} tone={stats.affiliatePendingCommissionCents > 0 ? "warn" : "neutral"} />
          </div>
        </div>
      )}

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
                <Link
                  href={`/admin/pedidos/${order.id}`}
                  className="text-foreground font-medium text-sm hover:text-primary transition-colors"
                >
                  {order.customerName}
                </Link>
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
