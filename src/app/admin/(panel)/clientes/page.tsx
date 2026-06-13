import { getAdminCustomers } from "@/app/actions/admin-customers";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";

const LIMIT = 30;

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
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

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string }>;
}

export default async function ClientesPage({ searchParams }: PageProps) {
  const { search, page } = await searchParams;
  const currentPage = Number(page ?? 1);

  const { rows, total } = await getAdminCustomers({ search, page: currentPage });
  const totalPages = Math.ceil(total / LIMIT);

  function buildUrl(overrides: Record<string, string | number | undefined>) {
    const p = new URLSearchParams();
    const merged = { search: search ?? "", page: currentPage, ...overrides };
    if (merged.search) p.set("search", String(merged.search));
    if (Number(merged.page) > 1) p.set("page", String(merged.page));
    const qs = p.toString();
    return `/admin/clientes${qs ? `?${qs}` : ""}`;
  }

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
          {rows.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground text-sm">
              <Users size={28} className="text-muted-foreground/40" />
              <span>Nenhum cliente encontrado</span>
            </div>
          )}
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
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Cliente</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">WhatsApp</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Pedidos</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Total gasto</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Último pedido</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Primeiro contato</th>
                <th className="text-right text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Ver</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted-foreground py-14">
                    <div className="flex flex-col items-center gap-2">
                      <Users size={28} className="text-muted-foreground/40" />
                      <span>Nenhum cliente encontrado</span>
                    </div>
                  </td>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {currentPage} de {totalPages}
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={buildUrl({ page: currentPage - 1 })}
                className="flex items-center gap-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground hover:bg-secondary/80"
              >
                <ChevronLeft size={14} />
                Anterior
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={buildUrl({ page: currentPage + 1 })}
                className="flex items-center gap-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground hover:bg-secondary/80"
              >
                Próxima
                <ChevronRight size={14} />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
