export const dynamic = "force-dynamic";

import { getAdminProducts } from "@/app/actions/admin-shop";
import { BulkProductsGrid } from "@/components/admin/BulkProductsGrid";
import { Pagination } from "@/components/admin/Pagination";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/pagination";
import Link from "next/link";
import { Plus } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ page?: string; category?: string; search?: string }>;
}

export default async function LojaPage({ searchParams }: PageProps) {
  const { page, category, search } = await searchParams;
  const currentPage = Number(page ?? 1);
  const LIMIT = ADMIN_PAGE_SIZE;

  const { rows, total } = await getAdminProducts({
    page: currentPage,
    category,
    search,
    limit: LIMIT,
  });

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground tracking-wide">
          LOJA
        </h2>
        <Link
          href="/admin/loja/novo"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Novo Produto
        </Link>
      </div>

      {/* Filtros */}
      <form method="GET" className="flex flex-wrap gap-3">
        <input
          type="text"
          name="search"
          defaultValue={search ?? ""}
          placeholder="Buscar por nome..."
          className="bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring w-56"
        />
        <select
          name="category"
          defaultValue={category ?? ""}
          className="bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todas as categorias</option>
          <option value="camisa_oficial">Camisa Oficial</option>
          <option value="camisa_torcedor">Camisa Torcedor</option>
        </select>
        <button
          type="submit"
          className="bg-secondary border border-border text-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          Filtrar
        </button>
        {(search || category) && (
          <Link
            href="/admin/loja"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors self-center"
          >
            Limpar filtros
          </Link>
        )}
      </form>

      <BulkProductsGrid rows={rows} />

      {/* Paginação */}
      <Pagination
        basePath="/admin/loja"
        currentPage={currentPage}
        totalPages={totalPages}
        params={{ search, category }}
      />
    </div>
  );
}
