import { getAdminOrders } from "@/app/actions/admin";
import { BulkOrdersTable } from "@/components/admin/BulkOrdersTable";
import { ExportOrdersButton } from "@/components/admin/ExportOrdersButton";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    search?: string;
  }>;
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

      <BulkOrdersTable rows={rows} />

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
