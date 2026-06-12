import { getAdminOrders } from "@/app/actions/admin";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ExportOrdersButton } from "@/components/admin/ExportOrdersButton";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    search?: string;
  }>;
}

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

const LIMIT = 20;

export default async function PedidosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const status = params.status ?? "all";
  const search = params.search ?? "";

  const { rows, total } = await getAdminOrders({
    page,
    status: status !== "all" ? status : undefined,
    search: search || undefined,
    limit: LIMIT,
  });

  const totalPages = Math.ceil(total / LIMIT);

  function buildUrl(overrides: Record<string, string | number | undefined>) {
    const p = new URLSearchParams();
    const merged = { page, status, search, ...overrides };
    if (merged.page && Number(merged.page) > 1) p.set("page", String(merged.page));
    if (merged.status && merged.status !== "all") p.set("status", String(merged.status));
    if (merged.search) p.set("search", String(merged.search));
    const qs = p.toString();
    return `/admin/pedidos${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl text-foreground tracking-wide">
          PEDIDOS
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {total} pedido{total !== 1 ? "s" : ""}
          </span>
          <ExportOrdersButton status={status !== "all" ? status : undefined} />
        </div>
      </div>

      {/* Filters */}
      <form
        method="GET"
        action="/admin/pedidos"
        className="flex flex-wrap gap-3 items-center"
      >
        <input
          name="search"
          defaultValue={search}
          type="search"
          placeholder="Buscar por nome, email ou WhatsApp..."
          className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground w-72 outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          name="status"
          defaultValue={status}
          className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="paid">Pago</option>
          <option value="cancelled">Cancelado</option>
          <option value="refunded">Reembolsado</option>
        </select>
        <button
          type="submit"
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Filtrar
        </button>
        {(search || status !== "all") && (
          <Link
            href="/admin/pedidos"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Limpar filtros
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  ID
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Nome
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  WhatsApp
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Total
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Método
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Data
                </th>
                <th className="text-right text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center text-muted-foreground py-10"
                  >
                    Nenhum pedido encontrado
                  </td>
                </tr>
              )}
              {rows.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {order.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {order.customerName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {order.customerWhatsapp}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {formatCurrency(order.totalCents)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground uppercase text-xs">
                    {order.gatewaySlug ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.displayStatus} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/pedidos/${order.id}`}
                      className="text-primary text-xs hover:underline"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildUrl({ page: page - 1 })}
                className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground hover:bg-secondary/80 transition-colors"
              >
                Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildUrl({ page: page + 1 })}
                className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground hover:bg-secondary/80 transition-colors"
              >
                Próxima
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
