export const dynamic = "force-dynamic";

import { getAdminOrders } from "@/app/actions/admin";
import { getCampaignProducts } from "@/app/actions/campaigns";
import { BulkOrdersTable } from "@/components/admin/BulkOrdersTable";
import { ExportOrdersButton } from "@/components/admin/ExportOrdersButton";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    search?: string;
    cortesia?: string;
    produto?: string;
    tipo?: string;
    de?: string;
    ate?: string;
  }>;
}

const LIMIT = 10;

export default async function PedidosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const status = params.status ?? "all";
  const search = params.search ?? "";
  const showCourtesy = params.cortesia === "1";
  const produto = params.produto ?? "";
  const tipo = params.tipo === "ticket" || params.tipo === "product" ? params.tipo : "";
  const de = params.de ?? "";
  const ate = params.ate ?? "";

  const [{ rows, total }, products] = await Promise.all([
    getAdminOrders({
      page,
      status: status !== "all" ? status : undefined,
      search: search || undefined,
      limit: LIMIT,
      excludeCourtesy: !showCourtesy,
      productId: produto || undefined,
      type: tipo || undefined,
      from: de || undefined,
      to: ate || undefined,
    }),
    getCampaignProducts(),
  ]);

  const totalPages = Math.ceil(total / LIMIT);
  const hasActiveFilters = !!(search || status !== "all" || produto || tipo || de || ate);

  function buildUrl(overrides: Record<string, string | number | undefined | boolean>) {
    const p = new URLSearchParams();
    const merged = {
      page, status, search, produto, tipo, de, ate,
      cortesia: showCourtesy ? "1" : undefined,
      ...overrides,
    };
    if (merged.page && Number(merged.page) > 1) p.set("page", String(merged.page));
    if (merged.status && merged.status !== "all") p.set("status", String(merged.status));
    if (merged.search) p.set("search", String(merged.search));
    if (merged.produto) p.set("produto", String(merged.produto));
    if (merged.tipo) p.set("tipo", String(merged.tipo));
    if (merged.de) p.set("de", String(merged.de));
    if (merged.ate) p.set("ate", String(merged.ate));
    if (merged.cortesia === "1") p.set("cortesia", "1");
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
          <ExportOrdersButton
            status={status !== "all" ? status : undefined}
            search={search || undefined}
            productId={produto || undefined}
            type={tipo || undefined}
            from={de || undefined}
            to={ate || undefined}
            excludeCourtesy={!showCourtesy}
          />
        </div>
      </div>

      {/* Filters */}
      <form
        method="GET"
        action="/admin/pedidos"
        className="flex flex-col gap-3"
      >
        {/* Preserva o estado do toggle de cortesias ao filtrar */}
        {showCourtesy && <input type="hidden" name="cortesia" value="1" />}

        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Buscar</label>
            <input
              name="search"
              defaultValue={search}
              type="search"
              placeholder="Nome, e-mail ou WhatsApp..."
              className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground w-64 outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              name="status"
              defaultValue={status}
              className="form-select bg-input border border-border rounded-lg pl-3 pr-9 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Todos os status</option>
              <option value="pending">Pendente</option>
              <option value="paid">Pago</option>
              <option value="cancelled">Cancelado</option>
              <option value="refunded">Reembolsado</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Tipo</label>
            <select
              name="tipo"
              defaultValue={tipo}
              className="form-select bg-input border border-border rounded-lg pl-3 pr-9 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos</option>
              <option value="ticket">Ingressos</option>
              <option value="product">Produtos</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Produto</label>
            <select
              name="produto"
              defaultValue={produto}
              className="form-select bg-input border border-border rounded-lg pl-3 pr-9 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring max-w-[14rem]"
            >
              <option value="">Todos os produtos</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">De</label>
            <input
              name="de"
              type="date"
              defaultValue={de}
              className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Até</label>
            <input
              name="ate"
              type="date"
              defaultValue={ate}
              className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Filtrar
          </button>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {hasActiveFilters && (
            <Link
              href={showCourtesy ? "/admin/pedidos?cortesia=1" : "/admin/pedidos"}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpar filtros
            </Link>
          )}
          <Link
            href={buildUrl({ cortesia: showCourtesy ? undefined : "1", page: 1 })}
            className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
              showCourtesy
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {showCourtesy ? "✕ Ocultar cortesias" : "Ver cortesias"}
          </Link>
        </div>
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
