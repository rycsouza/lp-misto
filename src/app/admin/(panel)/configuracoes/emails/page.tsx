export const dynamic = "force-dynamic";

import { getPaidOrdersForEmail } from "@/app/actions/admin";
import { EmailResendTable } from "@/components/admin/EmailResendTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { Mail } from "lucide-react";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/pagination";

const LIMIT = ADMIN_PAGE_SIZE;

interface PageProps {
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function EmailsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const search = params.search ?? "";

  const { rows, total } = await getPaidOrdersForEmail({ page, search, limit: LIMIT });
  const totalPages = Math.ceil(total / LIMIT);

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
        <EmptyState
          icon={Mail}
          title="Nenhum pedido pago ainda"
          description="Os e-mails de confirmação enviados aparecem aqui."
        />
      ) : (
        <EmailResendTable
          rows={rows}
          total={total}
          page={page}
          totalPages={totalPages}
          search={search}
        />
      )}
    </div>
  );
}
