import { getPaidOrdersForEmail } from "@/app/actions/admin";
import { EmailResendTable } from "@/components/admin/EmailResendTable";
import { Mail } from "lucide-react";

const LIMIT = 30;

interface PageProps {
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function EmailsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const search = params.search ?? "";

  const { rows, total } = await getPaidOrdersForEmail({ page, search, limit: LIMIT });
  const totalPages = Math.ceil(total / LIMIT);

  function buildUrl(overrides: Record<string, string | number>) {
    const p = new URLSearchParams();
    const merged = { page, search, ...overrides };
    if (Number(merged.page) > 1) p.set("page", String(merged.page));
    if (merged.search) p.set("search", String(merged.search));
    const qs = p.toString();
    return `/admin/configuracoes/emails${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl text-foreground tracking-wide flex items-center gap-2">
            <Mail size={20} className="text-primary" />
            REENVIO DE E-MAILS
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Lista todos os pedidos pagos. Use para reenviar o e-mail de confirmação a clientes que não o receberam.
          </p>
        </div>
      </div>

      {/* Search */}
      <form method="GET" action="/admin/configuracoes/emails" className="flex gap-2">
        <input
          name="search"
          defaultValue={search}
          placeholder="Buscar por nome, e-mail ou WhatsApp…"
          className="flex-1 px-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-secondary text-foreground text-sm font-medium rounded-md hover:bg-secondary/80 transition-colors"
        >
          Buscar
        </button>
        {search && (
          <a
            href="/admin/configuracoes/emails"
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Limpar
          </a>
        )}
      </form>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Mail size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum pedido pago encontrado.</p>
        </div>
      ) : (
        <EmailResendTable
          rows={rows}
          total={total}
          page={page}
          totalPages={totalPages}
          buildUrl={buildUrl}
        />
      )}
    </div>
  );
}
