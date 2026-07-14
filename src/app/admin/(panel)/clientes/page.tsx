export const dynamic = "force-dynamic";

import { getAdminCustomers } from "@/app/actions/admin-customers";
import { CUSTOMER_SORT_KEYS, type CustomerSortKey } from "@/lib/admin/customer-sort";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown, Users } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/pagination";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function formatWhatsapp(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return raw;
}

function toWaLink(raw: string) {
  const d = raw.replace(/\D/g, "");
  return `https://wa.me/${d.startsWith("55") ? d : `55${d}`}`;
}

// Direção padrão ao clicar numa coluna pela 1ª vez (texto=asc; número/data=desc)
const DEFAULT_DIR: Record<CustomerSortKey, "asc" | "desc"> = {
  name: "asc",
  whatsapp: "asc",
  orders: "desc",
  total: "desc",
  last: "desc",
  first: "desc",
};

type SortState = { sort: CustomerSortKey; dir: "asc" | "desc"; search?: string };

/** Link de ordenação: mesma coluna alterna asc/desc; nova coluna usa o padrão. */
function buildSortHref(col: CustomerSortKey, { sort, dir, search }: SortState): string {
  const nextDir = sort === col ? (dir === "asc" ? "desc" : "asc") : DEFAULT_DIR[col];
  const p = new URLSearchParams();
  if (search) p.set("search", search);
  p.set("sort", col);
  p.set("dir", nextDir);
  return `/admin/clientes?${p.toString()}`;
}

function SortIcon({ col, state }: { col: CustomerSortKey; state: SortState }) {
  if (state.sort !== col) return <ChevronsUpDown size={13} className="text-muted-foreground/40" />;
  return state.dir === "asc" ? (
    <ArrowUp size={13} className="text-primary" />
  ) : (
    <ArrowDown size={13} className="text-primary" />
  );
}

function SortHeader({
  col,
  label,
  state,
  align = "left",
}: {
  col: CustomerSortKey;
  label: string;
  state: SortState;
  align?: "left" | "right";
}) {
  const active = state.sort === col;
  return (
    <th className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"}`}>
      <Link
        href={buildSortHref(col, state)}
        className={`inline-flex items-center gap-1 text-xs uppercase tracking-wider transition-colors hover:text-foreground ${
          active ? "text-foreground" : "text-muted-foreground"
        } ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {label}
        <SortIcon col={col} state={state} />
      </Link>
    </th>
  );
}

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string; sort?: string; dir?: string }>;
}

export default async function ClientesPage({ searchParams }: PageProps) {
  const { search, page, sort: sortParam, dir: dirParam } = await searchParams;
  const currentPage = Number(page ?? 1);
  const sort: CustomerSortKey = (CUSTOMER_SORT_KEYS as readonly string[]).includes(sortParam ?? "")
    ? (sortParam as CustomerSortKey)
    : "first";
  const dir: "asc" | "desc" = dirParam === "asc" ? "asc" : "desc";

  const { rows, total } = await getAdminCustomers({ search, page: currentPage, sort, dir });
  const totalPages = Math.ceil(total / ADMIN_PAGE_SIZE);
  const sortState: SortState = { sort, dir, search };

  const emptyState = (
    <EmptyState
      icon={Users}
      title="Nenhum cliente ainda"
      description="Os clientes aparecem aqui após a primeira compra."
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-foreground tracking-wide">CLIENTES</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} cliente{total !== 1 ? "s" : ""} cadastrado{total !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Search */}
      <form method="get" action="/admin/clientes" className="flex gap-3 flex-wrap">
        <input
          name="search"
          type="text"
          defaultValue={search ?? ""}
          placeholder="Buscar por nome, e-mail ou WhatsApp..."
          className="bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring flex-1 min-w-[200px]"
        />
        <button
          type="submit"
          className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80"
        >
          Buscar
        </button>
        {search && (
          <Link
            href="/admin/clientes"
            className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80"
          >
            Limpar
          </Link>
        )}
      </form>

      <div className="bg-card border border-border rounded-xl overflow-hidden">

        {/* ── Mobile cards ─────────────────────────────────── */}
        <div className="md:hidden divide-y divide-border/50">
          {/* Ordenação no mobile */}
          {rows.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-secondary/20 text-xs overflow-x-auto">
              <span className="text-muted-foreground shrink-0">Ordenar:</span>
              {(
                [
                  { col: "first", label: "Recentes" },
                  { col: "name", label: "Nome" },
                  { col: "total", label: "Total gasto" },
                  { col: "orders", label: "Pedidos" },
                  { col: "last", label: "Último pedido" },
                ] as { col: CustomerSortKey; label: string }[]
              ).map(({ col, label }) => (
                <Link
                  key={col}
                  href={buildSortHref(col, sortState)}
                  className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition-colors ${
                    sort === col
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {label}
                  {sort === col && (dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </Link>
              ))}
            </div>
          )}
          {rows.length === 0 && emptyState}
          {rows.map((c) => (
            <div key={c.id} className="px-4 py-3 flex flex-col gap-1 hover:bg-secondary/20 transition-colors">
              {/* Name + link */}
              <div className="flex items-start justify-between gap-2">
                <p className="text-foreground font-medium text-sm">{c.name}</p>
                <Link
                  href={`/admin/clientes/${c.id}`}
                  className="text-primary text-xs hover:underline shrink-0"
                >
                  Detalhe
                </Link>
              </div>
              {/* Email */}
              <a
                href={`mailto:${c.email}`}
                className="text-muted-foreground text-xs hover:text-primary transition-colors"
              >
                {c.email}
              </a>
              {/* WhatsApp + stats */}
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <a
                  href={toWaLink(c.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground text-xs hover:text-green-500 transition-colors"
                >
                  {formatWhatsapp(c.whatsapp)}
                </a>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {c.paidOrderCount}
                    {c.orderCount > c.paidOrderCount && (
                      <span className="opacity-60">/{c.orderCount}</span>
                    )}{" "}
                    pedido{c.paidOrderCount !== 1 ? "s" : ""}
                  </span>
                  <span>·</span>
                  <span className="font-medium text-foreground">
                    {c.totalSpentCents > 0 ? formatCurrency(c.totalSpentCents) : "—"}
                  </span>
                </div>
              </div>
              {/* Dates */}
              <p className="text-muted-foreground text-xs">
                Último: {formatDate(c.lastOrderAt)} · Desde: {formatDate(c.firstSeenAt)}
              </p>
            </div>
          ))}
        </div>

        {/* ── Desktop table ─────────────────────────────────── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <SortHeader col="name" label="Cliente" state={sortState} />
                <SortHeader col="whatsapp" label="WhatsApp" state={sortState} />
                <SortHeader col="orders" label="Pedidos" state={sortState} />
                <SortHeader col="total" label="Total gasto" state={sortState} />
                <SortHeader col="last" label="Último pedido" state={sortState} />
                <SortHeader col="first" label="Primeiro contato" state={sortState} />
                <th className="text-right text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Ver</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7}>{emptyState}</td>
                </tr>
              )}
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-foreground font-medium text-sm">{c.name}</p>
                    <a
                      href={`mailto:${c.email}`}
                      className="text-muted-foreground text-xs hover:text-primary transition-colors"
                    >
                      {c.email}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={toWaLink(c.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground text-sm hover:text-green-500 transition-colors"
                    >
                      {formatWhatsapp(c.whatsapp)}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-foreground font-medium">{c.paidOrderCount}</span>
                    {c.orderCount > c.paidOrderCount && (
                      <span className="text-muted-foreground text-xs ml-1">
                        /{c.orderCount}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {c.totalSpentCents > 0 ? formatCurrency(c.totalSpentCents) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">
                    {formatDate(c.lastOrderAt)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">
                    {formatDate(c.firstSeenAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/clientes/${c.id}`}
                      className="text-primary text-xs hover:underline"
                    >
                      Detalhe
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      <Pagination
        basePath="/admin/clientes"
        currentPage={currentPage}
        totalPages={totalPages}
        params={{ search, sort, dir }}
      />
    </div>
  );
}
