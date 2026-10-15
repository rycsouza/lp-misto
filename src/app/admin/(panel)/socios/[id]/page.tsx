export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { getAdminMemberDetail, getAdminMemberPayments } from "@/app/actions/membership";
import { getAdminSession } from "@/app/actions/admin-auth";
import { freeMonthUntilLabel } from "@/lib/membership/promo";
import { MemberAdminActions } from "@/components/admin/MemberAdminActions";
import {
  MEMBER_STATUS_COLORS,
  MEMBER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/membership/labels";

interface PageProps {
  params: Promise<{ id: string }>;
}

const fmtDate = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const fmtDay = (s: string | null) => (s ? s.split("-").reverse().join("/") : "—");
const fmtPrice = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <div className="text-sm text-foreground break-words">{children}</div>
    </div>
  );
}

export default async function AdminMemberDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [member, session] = await Promise.all([getAdminMemberDetail(id), getAdminSession()]);
  if (!member) notFound();
  const { payments, error: paymentsError } = await getAdminMemberPayments(id);
  const isAdmin = session?.role === "admin";

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <Link
        href="/admin/socios"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft size={16} />
        Voltar para Sócios
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-xl text-foreground tracking-wide">{member.name}</h2>
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${MEMBER_STATUS_COLORS[member.status] ?? "bg-muted text-muted-foreground"}`}
        >
          {MEMBER_STATUS_LABELS[member.status] ?? member.status}
        </span>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field label="E-mail">
          <a href={`mailto:${member.email}`} className="hover:text-primary">{member.email}</a>
        </Field>
        <Field label="WhatsApp">{member.whatsapp ?? "—"}</Field>
        <Field label="CPF">{member.cpfMasked ?? "—"}</Field>
        <Field label="Plano">
          {member.planName ?? "—"}
          {member.planPriceCents != null && (
            <span className="text-muted-foreground"> · {fmtPrice(member.planPriceCents)}/mês</span>
          )}
        </Field>
        <Field label="Sócio desde">{fmtDate(member.createdAt)}</Field>
        <Field label={member.status === "cancelled" ? "Benefícios até" : "Próxima mensalidade"}>
          {member.nextBillingDate ? fmtDate(member.nextBillingDate) : "—"}
        </Field>
        {member.cancelledAt && <Field label="Cancelado em">{fmtDate(member.cancelledAt)}</Field>}
        {freeMonthUntilLabel(member) && <Field label="Promoção">{freeMonthUntilLabel(member)}</Field>}
        <Field label="Mural dos sócios">{member.wallName ?? "Não aparece"}</Field>
        <Field label="Gateway">
          {member.gatewaySlug ?? "—"}
          {member.subscriptionId && (
            <span className="block text-xs text-muted-foreground font-mono">{member.subscriptionId}</span>
          )}
        </Field>
        <Field label="Carteirinha">
          {member.cardPath ? (
            <a
              href={member.cardPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Abrir <ExternalLink size={12} />
            </a>
          ) : (
            "—"
          )}
        </Field>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Ações</h3>
        <MemberAdminActions
          memberId={member.id}
          status={member.status}
          hasSubscription={!!member.subscriptionId}
          isAdmin={isAdmin}
          wallName={member.wallName}
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Mensalidades (gateway)</h3>
        </div>
        {paymentsError && <p className="px-5 py-4 text-sm text-muted-foreground">{paymentsError}</p>}
        {!paymentsError && payments.length === 0 && (
          <p className="px-5 py-4 text-sm text-muted-foreground">
            {member.subscriptionId ? "Nenhuma mensalidade gerada ainda." : "Sem assinatura no gateway."}
          </p>
        )}
        {payments.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-5 py-2">Vencimento</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-5 py-2">Valor</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-5 py-2">Situação</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={`${p.dueDate}-${i}`} className="border-b border-border/50">
                  <td className="px-5 py-2 text-foreground">{fmtDay(p.dueDate)}</td>
                  <td className="px-5 py-2 text-foreground">{fmtPrice(p.valueCents)}</td>
                  <td className="px-5 py-2 text-muted-foreground">{PAYMENT_STATUS_LABELS[p.status] ?? p.status}</td>
                  <td className="px-5 py-2 text-right">
                    {p.invoiceUrl && (
                      <a
                        href={p.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Fatura <ExternalLink size={11} />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
