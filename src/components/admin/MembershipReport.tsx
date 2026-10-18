import Link from "next/link";
import { TrendingUp, Users, Receipt, Gift } from "lucide-react";
import { getMembershipReport, type MembershipReportView } from "@/app/actions/admin-membership-reports";
import { resolveMembershipPeriod, type MembershipPeriod } from "@/lib/membership/report-period";
import { ReportSectionTabs } from "@/components/admin/ReportSectionTabs";
import { MembershipReportExportButton } from "@/components/admin/MembershipReportExportButton";
import { MembershipHistoryImportButton } from "@/components/admin/MembershipHistoryImportButton";

function brl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <p className="shrink-0 font-semibold text-foreground tabular-nums text-sm">{value}</p>
    </div>
  );
}

function PlanTable({ report }: { report: MembershipReportView }) {
  if (report.plans.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Nenhum sócio ou pagamento neste período.</p>;
  }
  return (
    <>
      {/* Mobile: cards */}
      <ul className="sm:hidden divide-y divide-border/50">
        {report.plans.map((p) => (
          <li key={p.planId ?? "sem-plano"} className="px-4 py-3">
            <p className="text-sm font-medium text-foreground break-words">{p.planName}</p>
            <p className="text-xs text-muted-foreground tabular-nums mt-1">
              {p.activePaying} pagantes · {p.inTrial} em mês grátis · MRR {brl(p.mrrCents)}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {p.receivedCount} recebido(s) · bruta {brl(p.receivedGrossCents)} · líquida {brl(p.receivedNetCents)}
            </p>
          </li>
        ))}
      </ul>
      {/* Desktop: tabela */}
      <table className="hidden sm:table w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/30 text-xs text-muted-foreground uppercase tracking-wider">
            <th className="text-left px-5 py-2.5">Plano</th>
            <th className="text-right px-5 py-2.5">Pagantes</th>
            <th className="text-right px-5 py-2.5">Mês grátis</th>
            <th className="text-right px-5 py-2.5">Recebidos</th>
            <th className="text-right px-5 py-2.5">Receita bruta</th>
            <th className="text-right px-5 py-2.5">Receita líquida</th>
            <th className="text-right px-5 py-2.5">MRR</th>
          </tr>
        </thead>
        <tbody>
          {report.plans.map((p) => (
            <tr key={p.planId ?? "sem-plano"} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors">
              <td className="px-5 py-2.5 text-foreground">{p.planName}</td>
              <td className="px-5 py-2.5 text-right text-muted-foreground tabular-nums">{p.activePaying}</td>
              <td className="px-5 py-2.5 text-right text-muted-foreground tabular-nums">{p.inTrial}</td>
              <td className="px-5 py-2.5 text-right text-muted-foreground tabular-nums">{p.receivedCount}</td>
              <td className="px-5 py-2.5 text-right text-foreground tabular-nums">{brl(p.receivedGrossCents)}</td>
              <td className="px-5 py-2.5 text-right text-foreground tabular-nums">{brl(p.receivedNetCents)}</td>
              <td className="px-5 py-2.5 text-right font-semibold text-foreground tabular-nums">{brl(p.mrrCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/**
 * Aba "Sócio-torcedor" do relatório. Agregado: nenhum nome ou e-mail. A autorização
 * (dashboard + socios, com kill-switch) é aplicada na action; a página só mostra a
 * aba para quem tem acesso.
 */
export async function MembershipReport({ from, to }: { from?: string; to?: string }) {
  let period: MembershipPeriod;
  try {
    period = resolveMembershipPeriod({ from, to });
  } catch {
    period = resolveMembershipPeriod({});
  }
  const report = await getMembershipReport({ from: period.from, to: period.to });

  const kpis = [
    { label: "Receita recebida", value: brl(report.receivedGrossCents), icon: TrendingUp, accent: "text-green-500" },
    { label: "MRR pagante", value: brl(report.mrrCents), icon: Receipt, accent: "text-foreground" },
    { label: "Sócios pagantes", value: String(report.payingMembers), icon: Users, accent: "text-foreground" },
    { label: "Descontos de sócio", value: brl(report.memberDiscountCents), icon: Gift, accent: "text-foreground" },
  ];

  const financeiro = (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-2">Receita do período</h3>
        <Stat label="Receita bruta" value={brl(report.receivedGrossCents)} />
        <Stat
          label="Receita líquida"
          value={brl(report.receivedNetCents)}
          hint={
            report.receivedWithoutNetCount > 0
              ? `${report.receivedWithoutNetCount} pagamento(s) sem taxa informada pelo gateway (fora do líquido)`
              : "Após a taxa do gateway"
          }
        />
        <Stat label="Pagamentos recebidos" value={String(report.receivedCount)} />
        <Stat label="Ticket médio do período" value={brl(report.avgTicketCents)} hint="Bruto ÷ pagamentos recebidos" />
        <Stat label="Estornos" value={`${report.refundedCount} · ${brl(report.refundedCents)}`} />
        <Stat label="Chargebacks" value={`${report.chargebackCount} · ${brl(report.chargebackCents)}`} />
      </div>
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-2">Receita prevista</h3>
        <Stat label="MRR pagante" value={brl(report.mrrCents)} hint="Preço do plano dos sócios ativos fora do mês grátis" />
        <Stat label="Ticket médio por sócio pagante" value={brl(report.avgMemberMrrCents)} />
        <Stat
          label="Em mês grátis"
          value={`${report.trialMembers} sócio(s)`}
          hint="Ainda não pagaram: não entram no MRR"
        />
        <Stat label="MRR previsto do mês grátis" value={brl(report.trialMrrCents)} hint="Entra no MRR quando a 1ª mensalidade for paga" />
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden lg:col-span-2">
        <h3 className="font-semibold text-foreground px-5 py-3 border-b border-border">Por plano</h3>
        <PlanTable report={report} />
      </div>
    </div>
  );

  const socios = (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-2">Situação agora</h3>
        <Stat label="Ativos" value={String(report.activeMembers)} />
        <Stat label="Em mês grátis" value={String(report.trialMembers)} />
        <Stat
          label="Suspensos (inadimplentes)"
          value={String(report.suspendedMembers)}
          hint="Sem nomes aqui: a lista fica em Sócio-Torcedor"
        />
        <Stat
          label="Valor em aberto estimado"
          value={brl(report.suspendedEstimatedCents)}
          hint="1 mensalidade (preço do plano) por sócio suspenso"
        />
        <Stat
          label="Mensalidades vencidas registradas"
          value={`${report.overdueLedgerCount} · ${brl(report.overdueLedgerCents)}`}
          hint="Do histórico importado do gateway"
        />
        <Stat label="Pendentes (ainda não pagaram)" value={String(report.pendingMembers)} />
        <Stat label="Cancelados" value={String(report.cancelledMembers)} />
      </div>
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-2">Movimento do período</h3>
        <Stat label="Novas adesões" value={String(report.newMembers)} hint="Cadastros criados no período" />
        <Stat label="Cancelamentos" value={String(report.cancelledInPeriod)} />
        <Stat
          label="Churn do período"
          value={report.churnPct == null ? "—" : `${report.churnPct.toFixed(1).replace(".", ",")}%`}
          hint="Cancelamentos ÷ base aproximada no início do período"
        />
      </div>
    </div>
  );

  const beneficios = (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-2">Descontos de sócio</h3>
        <Stat label="Pedidos pagos com desconto" value={String(report.memberDiscountOrders)} />
        <Stat label="Desconto concedido" value={brl(report.memberDiscountCents)} hint="Soma dos descontos nos pedidos pagos" />
      </div>
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-2">Ingressos grátis</h3>
        <Stat label="Ingressos resgatados" value={String(report.freeTicketsRedeemed)} hint="Valor não é gravado no pedido: só a quantidade" />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Período (mesma convenção da aba Vendas: GET com from/to) */}
      <div className="flex flex-col gap-3 bg-card border border-border rounded-xl p-4">
        <form className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="aba" value="socios" />
          <div className="flex-1 min-w-[130px]">
            <label htmlFor="socios-from" className="text-xs text-muted-foreground block mb-1">
              De
            </label>
            <input
              type="date"
              id="socios-from"
              name="from"
              defaultValue={period.from}
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex-1 min-w-[130px]">
            <label htmlFor="socios-to" className="text-xs text-muted-foreground block mb-1">
              Até
            </label>
            <input
              type="date"
              id="socios-to"
              name="to"
              defaultValue={period.to}
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            className="bg-primary text-primary-foreground rounded-md px-5 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Aplicar
          </button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
          <p className="text-xs text-muted-foreground">
            Período de {fmtDay(period.from)} a {fmtDay(period.to)}. Receita pela data do pagamento.{" "}
            <Link href="/admin/socios" className="underline underline-offset-2 hover:text-foreground">
              Ver sócios
            </Link>
          </p>
          <div className="flex flex-wrap items-start gap-2">
            <MembershipHistoryImportButton />
            <MembershipReportExportButton from={report.range.from} to={report.range.to} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-card border border-border rounded-xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</p>
                <Icon size={15} className="text-muted-foreground/60 shrink-0" />
              </div>
              <p className={`text-lg sm:text-2xl font-bold tabular-nums ${k.accent}`}>{k.value}</p>
            </div>
          );
        })}
      </div>

      <ReportSectionTabs
        sections={[
          { key: "financeiro", label: "Financeiro", content: financeiro },
          { key: "socios", label: "Sócios", content: socios },
          { key: "beneficios", label: "Benefícios", content: beneficios },
        ]}
      />
    </div>
  );
}
