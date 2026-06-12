import { getAdminCustomerById } from "@/app/actions/admin-customers";
import { StatusBadge } from "@/components/admin/StatusBadge";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ShoppingCart, Mail, Phone } from "lucide-react";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatWhatsapp(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return raw;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_DISPLAY: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

export default async function ClienteDetailPage({ params }: PageProps) {
  const { id } = await params;
  const customer = await getAdminCustomerById(id);

  if (!customer) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <Link
        href="/admin/clientes"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft size={16} />
        Voltar para clientes
      </Link>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl text-foreground tracking-wide">
              {customer.name}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Cliente desde {formatDate(customer.firstSeenAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail size={14} />
            <span>{customer.email}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone size={14} />
            <span>{formatWhatsapp(customer.whatsapp)}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border">
          <div>
            <p className="text-2xl font-bold text-foreground">{customer.paidOrderCount}</p>
            <p className="text-xs text-muted-foreground">Compras concluídas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{customer.orderCount}</p>
            <p className="text-xs text-muted-foreground">Total de pedidos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {customer.totalSpentCents > 0 ? formatCurrency(customer.totalSpentCents) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Total gasto</p>
          </div>
        </div>
      </div>

      {/* Orders */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <ShoppingCart size={15} />
          Histórico de pedidos
        </h3>

        {customer.orders.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
            Nenhum pedido ainda
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">ID</th>
                  <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Total</th>
                  <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Data</th>
                  <th className="text-right text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Ver</th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map((order) => (
                  <tr key={order.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {order.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {formatCurrency(order.totalCents)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/pedidos/${order.id}`}
                        className="text-primary text-xs hover:underline"
                      >
                        Ver pedido
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
