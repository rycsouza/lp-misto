export const dynamic = "force-dynamic";

import { getAdminProducts } from "@/app/actions/admin-shop";
import { BulkProductsGrid } from "@/components/admin/BulkProductsGrid";
import { Pagination } from "@/components/admin/Pagination";
import { getAdminPageSize } from "@/lib/admin/page-size";
import Link from "next/link";
import { Plus } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ page?: string; category?: string; search?: string }>;
}

export default async function LojaPage({ searchParams }: PageProps) {
  const { page, category, search } = await searchParams;
  const currentPage = Number(page ?? 1);
  const LIMIT = await getAdminPageSize();

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
          className="form-select bg-input border border-border rounded-md pl-3 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todas as categorias</option>
          <option value="camisa_oficial">Camisa Oficial</option>
          <option value="camisa_torcedor">Camisa Torcedor</option>
        </select>
        <button
          type="submit"
          className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80 transition-colors"
        >
          Filtrar
        </button>
        {(search || category) && (
          <Link
            href="/admin/loja"
            className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80 transition-colors"
          >
            Limpar
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
