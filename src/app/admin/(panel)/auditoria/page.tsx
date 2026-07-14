export const dynamic = "force-dynamic";

import { getAdminAuditLog } from "@/app/actions/admin-audit";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/pagination";

const ENTITY_LABELS: Record<string, string> = {
  order: "Pedido",
  product: "Produto",
  player: "Jogador",
  news: "Notícia",
  sponsor: "Patrocinador",
  game: "Jogo",
  gateway: "Gateway",
  config: "Config",
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-500/15 text-green-600",
  update: "bg-blue-500/15 text-blue-600",
  delete: "bg-red-500/15 text-red-600",
  cancel: "bg-amber-500/15 text-amber-600",
  refund: "bg-purple-500/15 text-purple-600",
  duplicate: "bg-cyan-500/15 text-cyan-600",
};

function actionColor(action: string) {
  for (const [prefix, cls] of Object.entries(ACTION_COLORS)) {
    if (action.startsWith(prefix)) return cls;
  }
  return "bg-secondary text-muted-foreground";
}

function formatAction(action: string) {
  return action.replace(/_/g, " ");
}

function formatDate(date: Date) {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

const LIMIT = ADMIN_PAGE_SIZE;

interface PageProps {
  searchParams: Promise<{
    search?: string; entity?: string; dateFrom?: string; dateTo?: string; page?: string;
  }>;
}

export default async function AuditoriaPage({ searchParams }: PageProps) {
  const { search, entity, dateFrom, dateTo, page } = await searchParams;
  const currentPage = Number(page ?? 1);

  const { rows, total } = await getAdminAuditLog({ search, entity, dateFrom, dateTo, page: currentPage, limit: LIMIT });
  const totalPages = Math.ceil(total / LIMIT);

  const emptyAuditoria = (
    <EmptyState
      icon={ScrollText}
      title="Nenhum registro ainda"
      description="As ações administrativas ficam registradas aqui."
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-xl text-foreground tracking-wide">LOG DE AUDITORIA</h2>

      {/* Filters */}
      <form method="get" action="/admin/auditoria" className="flex flex-wrap gap-3">
        <input name="search" type="text" defaultValue={search ?? ""} placeholder="Buscar por ação..."
          className="bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring min-w-[180px]" />
        <select name="entity" defaultValue={entity ?? ""}
          className="form-select bg-input border border-border rounded-md pl-3 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
          <option value="">Todas entidades</option>
          {Object.entries(ENTITY_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <input name="dateFrom" type="date" defaultValue={dateFrom ?? ""}
          className="bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <input name="dateTo" type="date" defaultValue={dateTo ?? ""}
          className="bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <button type="submit" className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80">
          Filtrar
        </button>
        {(search || entity || dateFrom || dateTo) && (
          <Link href="/admin/auditoria" className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80">
            Limpar
          </Link>
        )}
      </form>

      <div className="bg-card border border-border rounded-xl overflow-hidden">

        {/* ── Mobile cards ─────────────────────────────────── */}
        <div className="md:hidden divide-y divide-border/50">
          {rows.length === 0 && emptyAuditoria}
          {rows.map((row) => (
            <div key={row.id} className="px-4 py-3 flex flex-col gap-1.5 hover:bg-secondary/20 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${actionColor(row.action)}`}>
                  {formatAction(row.action)}
                </span>
                <span className="text-muted-foreground text-xs">{ENTITY_LABELS[row.entity] ?? row.entity}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs">
                  {row.userEmail ?? "—"} · {row.entityId ? row.entityId.slice(0, 8) + "…" : "—"}
                </span>
                <span className="text-muted-foreground text-xs">{formatDate(row.createdAt)}</span>
              </div>
              {row.meta != null && (
                <p className="text-muted-foreground text-xs truncate">
                  {JSON.stringify(row.meta)}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* ── Desktop table ─────────────────────────────────── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Data</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Usuário</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Ação</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Entidade</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">ID</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6}>{emptyAuditoria}</td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3 text-foreground text-xs">{row.userEmail ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${actionColor(row.action)}`}>
                      {formatAction(row.action)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{ENTITY_LABELS[row.entity] ?? row.entity}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                    {row.entityId ? row.entityId.slice(0, 8) + "…" : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">
                    {row.meta ? JSON.stringify(row.meta) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {totalPages > 1 && (
        <p className="text-center text-xs text-muted-foreground">
          {total} registro{total !== 1 ? "s" : ""}
        </p>
      )}
      <Pagination
        basePath="/admin/auditoria"
        currentPage={currentPage}
        totalPages={totalPages}
        params={{ search, entity, dateFrom, dateTo }}
      />
    </div>
  );
}
