export const dynamic = "force-dynamic";

import Link from "next/link";
import { Plus } from "lucide-react";
import { getAdminRaffles, getAdminRaffleStatusCounts, type RaffleStatus } from "@/app/actions/admin-raffles";
import { RafflesTable } from "@/components/admin/RafflesTable";
import { Pagination } from "@/components/admin/Pagination";
import { getAdminPageSize } from "@/lib/admin/page-size";
import { cn } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}

const STATUS_TABS: { key: RaffleStatus | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "active", label: "À venda" },
  { key: "draft", label: "Rascunho" },
  { key: "closed", label: "Encerradas" },
  { key: "drawn", label: "Sorteados" },
  { key: "cancelled", label: "Cancelados" },
];

const VALID_STATUS = new Set<RaffleStatus>(["draft", "active", "closed", "drawn", "cancelled"]);

export default async function RifasPage({ searchParams }: PageProps) {
  const { page, search, status: statusParam } = await searchParams;
  const currentPage = Number(page ?? 1);
  const LIMIT = await getAdminPageSize();
  const status = statusParam && VALID_STATUS.has(statusParam as RaffleStatus) ? (statusParam as RaffleStatus) : undefined;

  const [{ rows, total }, counts] = await Promise.all([
    getAdminRaffles({ page: currentPage, search, limit: LIMIT, status }),
    getAdminRaffleStatusCounts(),
  ]);
  const totalPages = Math.ceil(total / LIMIT);

  function tabHref(key: RaffleStatus | "all") {
    const qs = new URLSearchParams();
    if (key !== "all") qs.set("status", key);
    if (search) qs.set("search", search);
    const s = qs.toString();
    return s ? `/admin/rifas?${s}` : "/admin/rifas";
  }

  const tabCount = (key: RaffleStatus | "all") => (key === "all" ? counts.all : counts.byStatus[key]);

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

      {/* Abas por status */}
      <div className="-mx-4 px-4 overflow-x-auto sm:mx-0 sm:px-0">
        <div className="flex gap-1 p-1 bg-secondary/40 border border-border rounded-xl w-max sm:w-auto sm:inline-flex">
          {STATUS_TABS.map((t) => {
            const active = (status ?? "all") === t.key;
            return (
              <Link
                key={t.key}
                href={tabHref(t.key)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "text-[11px] tabular-nums rounded-full px-1.5 py-0.5 min-w-5 text-center",
                    active ? "bg-primary-foreground/20" : "bg-secondary text-muted-foreground"
                  )}
                >
                  {tabCount(t.key)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <form method="GET" className="flex flex-wrap gap-3">
        {status && <input type="hidden" name="status" value={status} />}
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
          <Link href={tabHref(status ?? "all")} className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80 transition-colors">
            Limpar
          </Link>
        )}
      </form>

      <RafflesTable raffles={rows} />

      <Pagination basePath="/admin/rifas" currentPage={currentPage} totalPages={totalPages} params={{ search, status }} />
    </div>
  );
}
