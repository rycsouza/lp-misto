export const dynamic = "force-dynamic";

import Link from "next/link";
import { Plus } from "lucide-react";
import { getAdminRaffles } from "@/app/actions/admin-raffles";
import { RafflesTable } from "@/components/admin/RafflesTable";
import { Pagination } from "@/components/admin/Pagination";
import { getAdminPageSize } from "@/lib/admin/page-size";

interface PageProps {
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function RifasPage({ searchParams }: PageProps) {
  const { page, search } = await searchParams;
  const currentPage = Number(page ?? 1);
  const LIMIT = await getAdminPageSize();

  const { rows, total } = await getAdminRaffles({ page: currentPage, search, limit: LIMIT });
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground tracking-wide">RIFAS</h2>
        <Link
          href="/admin/rifas/novo"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Novo Sorteio
        </Link>
      </div>

      <form method="GET" className="flex flex-wrap gap-3">
        <input
          type="text"
          name="search"
          defaultValue={search ?? ""}
          placeholder="Buscar por nome..."
          className="bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring w-56"
        />
        <button type="submit" className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80 transition-colors">
          Filtrar
        </button>
        {search && (
          <Link href="/admin/rifas" className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80 transition-colors">
            Limpar
          </Link>
        )}
      </form>

      <RafflesTable raffles={rows} />

      <Pagination basePath="/admin/rifas" currentPage={currentPage} totalPages={totalPages} params={{ search }} />
    </div>
  );
}
