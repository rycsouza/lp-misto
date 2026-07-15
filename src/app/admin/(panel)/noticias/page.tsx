export const dynamic = "force-dynamic";

import { getAdminNews } from "@/app/actions/admin-content";
import { NewsActions } from "@/components/admin/NewsActions";
import Link from "next/link";
import { Plus, Newspaper } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";
import { getAdminPageSize } from "@/lib/admin/page-size";

const categoryLabels: Record<string, string> = {
  futebol_profissional: "Futebol Profissional",
  base: "Base",
  institucional: "Institucional",
  socio_torcedor: "Sócio-Torcedor",
  patrocinadores: "Patrocinadores",
};

const categoryColors: Record<string, string> = {
  futebol_profissional: "bg-green-500/15 text-green-600",
  base: "bg-blue-500/15 text-blue-600",
  institucional: "bg-purple-500/15 text-purple-600",
  socio_torcedor: "bg-amber-500/15 text-amber-600",
  patrocinadores: "bg-cyan-500/15 text-cyan-600",
};

interface PageProps {
  searchParams: Promise<{ page?: string; category?: string; search?: string }>;
}

export default async function NoticiasPage({ searchParams }: PageProps) {
  const { page = "1", category, search } = await searchParams;
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const LIMIT = await getAdminPageSize();

  const { rows, total } = await getAdminNews({ page: currentPage, category, search, limit: LIMIT });
  const totalPages = Math.ceil(total / LIMIT);

  const emptyState = (
    <EmptyState
      icon={Newspaper}
      title="Nenhuma notícia ainda"
      description="Publique novidades, comunicados e bastidores para a torcida."
      action={{ label: "Nova notícia", href: "/admin/noticias/novo" }}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground tracking-wide">NOTÍCIAS</h2>
        <Link href="/admin/noticias/novo"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity">
          <Plus size={16} />Nova Notícia
        </Link>
      </div>

      <form method="get" action="/admin/noticias" className="flex flex-wrap gap-3">
        <input name="search" type="text" defaultValue={search ?? ""} placeholder="Buscar por título..."
          className="bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring flex-1 min-w-[180px]" />
        <select name="category" defaultValue={category ?? ""}
          className="form-select bg-input border border-border rounded-md pl-3 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
          <option value="">Todas as categorias</option>
          {Object.entries(categoryLabels).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <button type="submit" className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80">Filtrar</button>
        {(search || category) && (
          <Link href="/admin/noticias" className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80">Limpar</Link>
        )}
      </form>

      <div className="bg-card border border-border rounded-xl overflow-hidden">

        {/* ── Mobile cards ─────────────────────────────────── */}
        <div className="md:hidden divide-y divide-border/50">
          {rows.length === 0 && emptyState}
          {rows.map((row) => (
            <div key={row.id} className="px-4 py-3 flex flex-col gap-1.5 hover:bg-secondary/20 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <p className="text-foreground font-medium text-sm line-clamp-2 flex-1">{row.title}</p>
                {row.featured && <span className="text-base shrink-0">⭐</span>}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${categoryColors[row.category] ?? "bg-muted text-muted-foreground"}`}>
                    {categoryLabels[row.category] ?? row.category}
                  </span>
                  <span className={row.active
                    ? "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600"
                    : "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"}>
                    {row.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <span className="text-muted-foreground text-xs">
                  {row.publishedAt ? new Date(row.publishedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}
                </span>
              </div>
              <div className="flex justify-end">
                <NewsActions newsId={row.id} isActive={row.active} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Desktop table ─────────────────────────────────── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Título</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Categoria</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Destaque</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Ativo</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Publicação</th>
                <th className="text-right text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6}>{emptyState}</td></tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 text-foreground font-medium max-w-xs">
                    <span className="block truncate" title={row.title}>{row.title}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${categoryColors[row.category] ?? "bg-muted text-muted-foreground"}`}>
                      {categoryLabels[row.category] ?? row.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-base">{row.featured ? "⭐" : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={row.active
                      ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600"
                      : "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"}>
                      {row.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {row.publishedAt ? new Date(row.publishedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right"><NewsActions newsId={row.id} isActive={row.active} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      <Pagination
        basePath="/admin/noticias"
        currentPage={currentPage}
        totalPages={totalPages}
        params={{ category, search }}
      />
    </div>
  );
}
