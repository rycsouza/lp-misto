import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { pageRange } from "@/lib/admin/pagination";

interface PaginationProps {
  basePath: string;
  currentPage: number;
  totalPages: number;
  /** Demais parâmetros de query a preservar (busca, filtros, ordenação). */
  params?: Record<string, string | number | undefined | null>;
}

/**
 * Paginação numerada reutilizável (1 2 3 … N) com Anterior/Próxima.
 * Server component — monta os links preservando busca/filtros/ordenação.
 */
export function Pagination({ basePath, currentPage, totalPages, params = {} }: PaginationProps) {
  if (totalPages <= 1) return null;

  function href(page: number): string {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
    }
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  }

  const items = pageRange(currentPage, totalPages);
  const cellBase =
    "inline-flex items-center justify-center min-w-10 h-10 px-2 rounded-lg text-sm transition-colors";

  return (
    <nav className="flex items-center justify-center gap-1 flex-wrap" aria-label="Paginação">
      {currentPage > 1 ? (
        <Link href={href(currentPage - 1)} aria-label="Página anterior" className={cn(cellBase, "border border-border text-foreground hover:bg-secondary")}>
          <ChevronLeft size={16} />
        </Link>
      ) : (
        <span aria-disabled className={cn(cellBase, "border border-border/50 text-muted-foreground/40")}>
          <ChevronLeft size={16} />
        </span>
      )}

      {items.map((it, i) =>
        it === "…" ? (
          <span key={`gap-${i}`} className={cn(cellBase, "text-muted-foreground pointer-events-none")}>
            …
          </span>
        ) : (
          <Link
            key={it}
            href={href(it)}
            aria-current={it === currentPage ? "page" : undefined}
            className={cn(
              cellBase,
              it === currentPage
                ? "bg-primary text-primary-foreground font-semibold"
                : "border border-border text-foreground hover:bg-secondary tabular-nums"
            )}
          >
            {it}
          </Link>
        )
      )}

      {currentPage < totalPages ? (
        <Link href={href(currentPage + 1)} aria-label="Próxima página" className={cn(cellBase, "border border-border text-foreground hover:bg-secondary")}>
          <ChevronRight size={16} />
        </Link>
      ) : (
        <span aria-disabled className={cn(cellBase, "border border-border/50 text-muted-foreground/40")}>
          <ChevronRight size={16} />
        </span>
      )}
    </nav>
  );
}
