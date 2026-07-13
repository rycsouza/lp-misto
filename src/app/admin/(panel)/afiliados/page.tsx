export const dynamic = "force-dynamic";

import Link from "next/link";
import { Plus, Pencil, Users2 } from "lucide-react";
import { getAdminAffiliates, deleteAffiliate } from "@/app/actions/admin-affiliates";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";
import { CopyLinkButton } from "@/components/admin/CopyLinkButton";
import { AfiliadosTabs } from "./AfiliadosTabs";
import { EmptyState } from "@/components/admin/EmptyState";
import { getAppBaseUrl } from "@/lib/base-url";

function fmtCents(cents: number) {
  return `R$${(cents / 100).toFixed(2).replace(".", ",")}`;
}

async function DeleteAffiliateButton({ id, name }: { id: string; name: string }) {
  async function action() {
    "use server";
    await deleteAffiliate(id);
  }
  return <AdminDeleteButton action={action} confirmMessage={`Excluir afiliado "${name}"?`} />;
}

export default async function AfiliadosAdminPage() {
  const affiliates = await getAdminAffiliates();
  const appUrl = (await getAppBaseUrl()).replace(/\/$/, "");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground">
          Afiliados
        </h1>
        <Link
          href="/admin/afiliados/novo"
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> Novo Afiliado
        </Link>
      </div>

      <AfiliadosTabs />

      {affiliates.length === 0 ? (
        <EmptyState
          icon={Users2}
          title="Nenhum afiliado ainda"
          description="Cadastre parceiros que divulgam o clube e ganham comissão por venda."
          action={{ label: "Novo afiliado", href: "/admin/afiliados/novo" }}
        />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-muted-foreground font-medium">Afiliado</th>
                <th className="px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Código</th>
                <th className="px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Comissão</th>
                <th className="px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Indicações</th>
                <th className="px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">A pagar</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="px-4 py-3 text-muted-foreground font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {affiliates.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.email}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex items-center gap-1.5">
                      <code className="text-xs font-mono bg-secondary px-2 py-0.5 rounded">{a.code}</code>
                      <CopyLinkButton url={`${appUrl}/afiliados/${a.code}`} />
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-foreground font-semibold">
                    {a.commissionType === "pct" ? `${a.commissionValue}%` : fmtCents(a.commissionValue)}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {a.totalReferrals}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-orange-500 font-medium">
                    {a.pendingCommissionCents > 0 ? fmtCents(a.pendingCommissionCents) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {a.active ? (
                      <span className="text-xs text-green-500 bg-green-500/10 rounded-full px-2 py-0.5">Ativo</span>
                    ) : (
                      <span className="text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">Inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/afiliados/${a.id}`}
                        className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil size={15} />
                      </Link>
                      <DeleteAffiliateButton id={a.id} name={a.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
