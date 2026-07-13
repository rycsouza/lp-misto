export const dynamic = "force-dynamic";

import { Banknote } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { getWithdrawals } from "@/app/actions/admin-affiliates";
import { WithdrawalActions } from "./WithdrawalActions";
import { AfiliadosTabs } from "../AfiliadosTabs";

function fmtCents(cents: number) {
  return `R$${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  requested: { label: "Solicitado", className: "text-orange-500 bg-orange-500/10" },
  processing: { label: "Processando", className: "text-blue-500 bg-blue-500/10" },
  paid: { label: "Pago", className: "text-green-500 bg-green-500/10" },
  rejected: { label: "Rejeitado", className: "text-destructive bg-destructive/10" },
};

export default async function SaquesAdminPage() {
  const withdrawals = await getWithdrawals();

  const pendingCount = withdrawals.filter((w) =>
    w.status === "requested" || w.status === "processing"
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground">
          Afiliados
        </h1>
        {pendingCount > 0 && (
          <span className="text-xs text-orange-500 font-medium">
            {pendingCount} saque{pendingCount !== 1 ? "s" : ""} pendente{pendingCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <AfiliadosTabs />

      {withdrawals.length === 0 ? (
        <div className="bg-card border border-border rounded-xl">
          <EmptyState
            icon={Banknote}
            title="Nenhum saque solicitado"
            description="Os pedidos de saque de comissão aparecem aqui."
          />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-muted-foreground font-medium">Afiliado</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Valor</th>
                <th className="px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Chave PIX</th>
                <th className="px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Data</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="px-4 py-3 text-muted-foreground font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => {
                const statusInfo = STATUS_LABEL[w.status] ?? {
                  label: w.status,
                  className: "text-muted-foreground bg-secondary",
                };
                const isPending = w.status === "requested" || w.status === "processing";
                return (
                  <tr
                    key={w.id}
                    className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{w.affiliateName}</div>
                      <code className="text-xs font-mono text-muted-foreground">
                        {w.affiliateCode}
                      </code>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {fmtCents(w.amountCents)}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="text-foreground text-xs">{w.pixKey}</div>
                      <div className="text-muted-foreground text-xs capitalize">{w.pixKeyType}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                      {fmtDate(w.requestedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span
                          className={`text-xs rounded-full px-2 py-0.5 ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </span>
                        {w.rejectionReason && (
                          <p className="text-xs text-muted-foreground mt-1 max-w-[160px] truncate">
                            {w.rejectionReason}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isPending ? (
                        <WithdrawalActions withdrawalId={w.id} />
                      ) : (
                        <span className="text-xs text-muted-foreground block text-right">
                          {w.processedAt ? fmtDate(w.processedAt) : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
