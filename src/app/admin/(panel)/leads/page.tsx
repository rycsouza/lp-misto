import { getAdminLeads } from "@/app/actions/admin-growth";
import { LeadsExportButton } from "@/components/admin/LeadsExportButton";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    source?: string;
    search?: string;
  }>;
}

const SOURCE_LABELS: Record<string, string> = {
  ticket_checkout: "Checkout Ingresso",
  membership_interest: "Sócio-Torcedor",
  sponsorship_interest: "Patrocinador",
  newsletter: "Newsletter",
  history_gallery: "Galeria Histórica",
};

const SOURCE_COLORS: Record<string, string> = {
  ticket_checkout:
    "bg-blue-500/15 text-blue-600",
  membership_interest:
    "bg-purple-500/15 text-purple-600",
  sponsorship_interest:
    "bg-yellow-500/15 text-yellow-600",
  newsletter:
    "bg-green-500/15 text-green-600",
  history_gallery:
    "bg-orange-500/15 text-orange-600",
};

export default async function LeadsPage({ searchParams }: PageProps) {
  const { page, source, search } = await searchParams;
  const currentPage = Number(page ?? 1);

  const { rows, total } = await getAdminLeads({
    page: currentPage,
    source,
    search,
    limit: 20,
  });

  const totalPages = Math.ceil(total / 20);

  function buildUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { page: String(currentPage), source, search, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "undefined") params.set(k, v);
    }
    return `/admin/leads?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground tracking-wide">
          LEADS
        </h2>
        <LeadsExportButton source={source} />
      </div>

      {/* Filtros */}
      <form method="GET" className="flex flex-wrap gap-3">
        <input
          type="text"
          name="search"
          defaultValue={search ?? ""}
          placeholder="Buscar por nome ou email..."
          className="bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring w-64"
        />
        <select
          name="source"
          defaultValue={source ?? ""}
          className="bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todas as fontes</option>
          {Object.entries(SOURCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-secondary border border-border text-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          Filtrar
        </button>
        {(search || source) && (
          <Link
            href="/admin/leads"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors self-center"
          >
            Limpar filtros
          </Link>
        )}
      </form>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Nome
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Email
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  WhatsApp
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Fonte
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Data
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center text-muted-foreground py-10"
                  >
                    Nenhum lead encontrado
                  </td>
                </tr>
              )}
              {rows.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-4 py-3 text-foreground font-medium">
                    {lead.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {lead.email}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {lead.whatsapp ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${SOURCE_COLORS[lead.source] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {SOURCE_LABELS[lead.source] ?? lead.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Mostrando {(currentPage - 1) * 20 + 1}–
            {Math.min(currentPage * 20, total)} de {total} leads
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={buildUrl({ page: String(currentPage - 1) })}
                className="px-3 py-1.5 rounded-md border border-border hover:bg-secondary transition-colors"
              >
                Anterior
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={buildUrl({ page: String(currentPage + 1) })}
                className="px-3 py-1.5 rounded-md border border-border hover:bg-secondary transition-colors"
              >
                Próxima
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
