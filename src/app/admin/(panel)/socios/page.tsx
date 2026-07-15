export const dynamic = "force-dynamic";

import {
  getAdminMembershipPlans,
  getAdminMembers,
} from "@/app/actions/admin-growth";
import Link from "next/link";
import { Plus, CreditCard, Heart } from "lucide-react";
import { MembersExportButton } from "@/components/admin/MembersExportButton";
import { EmptyState } from "@/components/admin/EmptyState";
import { getAdminPageSize } from "@/lib/admin/page-size";
import { Pagination } from "@/components/admin/Pagination";

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    status?: string;
    planId?: string;
    search?: string;
  }>;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  active: "Ativo",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-600",
  active: "bg-green-500/15 text-green-600",
  cancelled: "bg-destructive/15 text-destructive",
};

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default async function SociosPage({ searchParams }: PageProps) {
  const { tab, page, status, planId, search } = await searchParams;
  const activeTab = tab === "socios" ? "socios" : "planos";
  const currentPage = Number(page ?? 1);

  const LIMIT = await getAdminPageSize();

  const plans = await getAdminMembershipPlans();
  const { rows: memberRows, total: memberTotal } =
    activeTab === "socios"
      ? await getAdminMembers({ page: currentPage, status, planId, search, limit: LIMIT })
      : { rows: [], total: 0 };

  const totalPages = Math.ceil(memberTotal / LIMIT);

  const emptySocios = (
    <EmptyState
      icon={Heart}
      title="Nenhum sócio ainda"
      description="Os torcedores aparecem aqui quando aderem a um plano."
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground tracking-wide">
          SÓCIO-TORCEDOR
        </h2>
        {activeTab === "planos" && (
          <Link
            href="/admin/socios/planos/novo"
            className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            Novo Plano
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <Link
          href="/admin/socios?tab=planos"
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "planos"
              ? "text-primary border-b-2 border-primary -mb-px"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Planos
        </Link>
        <Link
          href="/admin/socios?tab=socios"
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "socios"
              ? "text-primary border-b-2 border-primary -mb-px"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Sócios
        </Link>
      </div>

      {/* Tab Planos */}
      {activeTab === "planos" && (
        <div className="flex flex-col gap-4">
          {plans.length === 0 ? (
            <div className="bg-card border border-border rounded-xl">
              <EmptyState
                icon={CreditCard}
                title="Nenhum plano ainda"
                description="Crie planos de sócio-torcedor com valores e benefícios."
                action={{ label: "Novo plano", href: "/admin/socios/planos/novo" }}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      <p className="text-foreground font-semibold">
                        {plan.name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Ícone: {plan.icon}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {plan.highlight && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/15 text-yellow-600">
                          Destaque
                        </span>
                      )}
                      <span
                        className={
                          plan.active
                            ? "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600"
                            : "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"
                        }
                      >
                        {plan.active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </div>

                  <p className="text-primary font-bold text-lg">
                    {formatPrice(plan.priceCents)}
                    <span className="text-muted-foreground font-normal text-sm">
                      /mês
                    </span>
                  </p>

                  {plan.benefits.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {plan.benefits.map((benefit) => (
                        <li
                          key={benefit.id}
                          className="text-muted-foreground text-xs flex items-center gap-1.5"
                        >
                          <span className="text-primary">✓</span>
                          {benefit.label}
                        </li>
                      ))}
                    </ul>
                  )}

                  <Link
                    href={`/admin/socios/planos/${plan.id}`}
                    className="text-primary hover:opacity-80 transition-opacity text-xs font-medium mt-auto"
                  >
                    Editar plano →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Sócios */}
      {activeTab === "socios" && (
        <div className="flex flex-col gap-4">
          {/* Filtros */}
          <div className="flex flex-wrap items-start gap-3">
            <form method="GET" className="flex flex-wrap gap-3 flex-1">
              <input type="hidden" name="tab" value="socios" />
              <input
                type="text"
                name="search"
                defaultValue={search ?? ""}
                placeholder="Buscar por nome ou email..."
                className="bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring w-64"
              />
              <select
                name="status"
                defaultValue={status ?? ""}
                className="form-select bg-input border border-border rounded-md pl-3 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Todos os status</option>
                <option value="pending">Pendente</option>
                <option value="active">Ativo</option>
                <option value="cancelled">Cancelado</option>
              </select>
              <select
                name="planId"
                defaultValue={planId ?? ""}
                className="form-select bg-input border border-border rounded-md pl-3 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Todos os planos</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="bg-secondary border border-border text-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-secondary/80 transition-colors"
              >
                Filtrar
              </button>
            </form>
            <MembersExportButton status={status} />
          </div>

          {/* Tabela */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">

            {/* ── Mobile cards ─────────────────────────────────── */}
            <div className="md:hidden divide-y divide-border/50">
              {memberRows.length === 0 && emptySocios}
              {memberRows.map((member) => (
                <div key={member.id} className="px-4 py-3 flex flex-col gap-1 hover:bg-secondary/20 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-foreground font-medium text-sm">{member.name}</p>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[member.status] ?? "bg-muted text-muted-foreground"}`}>
                      {STATUS_LABELS[member.status] ?? member.status}
                    </span>
                  </div>
                  <a href={`mailto:${member.email}`} className="text-muted-foreground text-xs hover:text-primary transition-colors">
                    {member.email}
                  </a>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {member.whatsapp ? (
                        <a href={`https://wa.me/${member.whatsapp.replace(/\D/g, "").replace(/^(?!55)/, "55")}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-muted-foreground text-xs hover:text-green-500 transition-colors">
                          {member.whatsapp}
                        </a>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                      {member.planName && (
                        <span className="text-muted-foreground text-xs">· {member.planName}</span>
                      )}
                    </div>
                    <span className="text-muted-foreground text-xs">{new Date(member.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop table ─────────────────────────────────── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Nome</th>
                    <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Email</th>
                    <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">WhatsApp</th>
                    <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Plano</th>
                    <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {memberRows.length === 0 && (
                    <tr><td colSpan={6}>{emptySocios}</td></tr>
                  )}
                  {memberRows.map((member) => (
                    <tr key={member.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-foreground font-medium">{member.name}</td>
                      <td className="px-4 py-3">
                        <a href={`mailto:${member.email}`} className="text-muted-foreground hover:text-primary transition-colors">
                          {member.email}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        {member.whatsapp ? (
                          <a href={`https://wa.me/${member.whatsapp.replace(/\D/g, "").replace(/^(?!55)/, "55")}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-green-500 transition-colors">
                            {member.whatsapp}
                          </a>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{member.planName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[member.status] ?? "bg-muted text-muted-foreground"}`}>
                          {STATUS_LABELS[member.status] ?? member.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(member.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>

          {/* Paginação */}
          <Pagination
            basePath="/admin/socios"
            currentPage={currentPage}
            totalPages={totalPages}
            params={{ tab: "socios", search, status, planId }}
          />
        </div>
      )}
    </div>
  );
}
