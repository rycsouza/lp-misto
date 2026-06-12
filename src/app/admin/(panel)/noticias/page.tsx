import { getAdminNews } from "@/app/actions/admin-content";
import { NewsActions } from "@/components/admin/NewsActions";
import Link from "next/link";
import { Plus } from "lucide-react";

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

  const { rows, total } = await getAdminNews({
    page: currentPage,
    category,
    search,
  });

  const totalPages = Math.ceil(total / 20);

  function buildUrl(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    if (params.page && params.page !== "1") sp.set("page", params.page);
    if (params.category) sp.set("category", params.category);
    if (params.search) sp.set("search", params.search);
    const qs = sp.toString();
    return `/admin/noticias${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground tracking-wide">
          NOTÍCIAS
        </h2>
        <Link
          href="/admin/noticias/novo"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Nova Notícia
        </Link>
      </div>

      {/* Filters */}
      <form method="get" action="/admin/noticias" className="flex flex-wrap gap-3">
        <input
          name="search"
          type="text"
          defaultValue={search ?? ""}
          placeholder="Buscar por título..."
          className="bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring min-w-[200px]"
        />
        <select
          name="category"
          defaultValue={category ?? ""}
          className="bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todas as categorias</option>
          {Object.entries(categoryLabels).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80"
        >
          Filtrar
        </button>
        {(search || category) && (
          <Link
            href="/admin/noticias"
            className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80"
          >
            Limpar
          </Link>
        )}
      </form>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Título
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Categoria
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Destaque
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Ativo
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Publicação
                </th>
                <th className="text-right text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center text-muted-foreground py-10"
                  >
                    Nenhuma notícia encontrada
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-4 py-3 text-foreground font-medium max-w-xs">
                    <span className="block truncate" title={row.title}>
                      {row.title}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${categoryColors[row.category] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {categoryLabels[row.category] ?? row.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-base">
                    {row.featured ? "⭐" : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.active
                          ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600"
                          : "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"
                      }
                    >
                      {row.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {row.publishedAt
                      ? new Date(row.publishedAt).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <NewsActions newsId={row.id} isActive={row.active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-end">
          {currentPage > 1 && (
            <Link
              href={buildUrl({
                page: String(currentPage - 1),
                category,
                search,
              })}
              className="bg-secondary text-foreground rounded-md px-3 py-1.5 text-sm hover:bg-secondary/80"
            >
              Anterior
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={buildUrl({
                page: String(currentPage + 1),
                category,
                search,
              })}
              className="bg-secondary text-foreground rounded-md px-3 py-1.5 text-sm hover:bg-secondary/80"
            >
              Próxima
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
