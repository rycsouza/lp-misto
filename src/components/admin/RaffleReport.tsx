import { Ticket, TrendingUp, Users, Timer, Hash, Dices, Award, ExternalLink } from "lucide-react";
import { getRaffleReport } from "@/app/actions/admin-raffles";
import { RafflePicker } from "@/components/admin/RafflePicker";

function brl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function num(n: number): string {
  return n.toLocaleString("pt-BR");
}
function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", active: "À venda", closed: "Vendas encerradas", drawn: "Sorteado", cancelled: "Cancelado",
};

/** Relatório de rifas — aba "Rifas" da tela de relatórios. */
export async function RaffleReport({ rifa }: { rifa?: string }) {
  const { picker, overview, report } = await getRaffleReport(rifa).catch(() => ({
    picker: [],
    overview: { raffles: 0, sold: 0, revenueCents: 0 },
    report: null,
  }));

  const kpis = report
    ? [
        { label: "Números vendidos", value: `${num(report.sold)} / ${num(report.totalNumbers)}`, icon: Ticket, accent: "text-foreground" },
        { label: "Receita", value: brl(report.revenueCents), icon: TrendingUp, accent: "text-green-500" },
        { label: "Participantes", value: num(report.participants), icon: Users, accent: "text-foreground" },
        { label: "Reservados", value: num(report.reserved), icon: Timer, accent: "text-foreground" },
        { label: "Disponíveis", value: num(report.available), icon: Hash, accent: "text-foreground" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      {/* Visão geral (todas as rifas) */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Sorteios</p>
            <Dices size={15} className="text-muted-foreground/60 shrink-0" />
          </div>
          <p className="text-lg sm:text-2xl font-bold tabular-nums text-foreground">{num(overview.raffles)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Nº vendidos (todos)</p>
            <Ticket size={15} className="text-muted-foreground/60 shrink-0" />
          </div>
          <p className="text-lg sm:text-2xl font-bold tabular-nums text-foreground">{num(overview.sold)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Receita total</p>
            <TrendingUp size={15} className="text-muted-foreground/60 shrink-0" />
          </div>
          <p className="text-lg sm:text-2xl font-bold tabular-nums text-green-500">{brl(overview.revenueCents)}</p>
        </div>
      </div>

      {/* Seletor de sorteio */}
      <div className="bg-card border border-border rounded-xl p-4">
        <RafflePicker raffles={picker} selected={report?.id ?? ""} />
      </div>

      {!report ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
          Nenhum sorteio cadastrado ainda.
        </div>
      ) : (
        <>
          {/* Identificação */}
          <div className="bg-card border border-border rounded-xl px-4 sm:px-5 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {report.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={report.coverImage} alt={report.name} className="w-14 h-14 rounded-xl object-cover border border-border shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground truncate">{report.name}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {STATUS_LABEL[report.status] ?? report.status} · {brl(report.numberPriceCents)} / número
                  {report.drawnAt ? ` · sorteado em ${fmtDate(report.drawnAt)}` : report.salesEndsAt ? ` · encerra ${fmtDate(report.salesEndsAt)}` : ""}
                </p>
              </div>
            </div>
            <a
              href={`/rifa/${report.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors"
              title="Abrir página pública"
            >
              <ExternalLink size={14} /> <span className="hidden sm:inline">Ver página</span>
            </a>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
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

          {/* Progresso de vendas */}
          <div className="bg-card border border-border rounded-xl px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-foreground">Progresso de vendas</p>
              <span className="text-sm text-muted-foreground tabular-nums">{report.soldPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${report.soldPct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2 tabular-nums">
              {num(report.sold)} vendidos · {num(report.reserved)} reservados · {num(report.available)} disponíveis
            </p>
          </div>

          {/* Prêmios e ganhadores */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <h3 className="font-semibold text-foreground px-5 py-3 border-b border-border flex items-center gap-2">
              <Award size={16} className="text-primary" /> Prêmios e ganhadores
            </h3>
            {report.prizes.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground text-center">Nenhum prêmio cadastrado.</p>
            ) : (
              <ul className="divide-y divide-border/50">
                {report.prizes.map((p, i) => (
                  <li key={p.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                    <span className="shrink-0 w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xs font-bold tabular-nums">
                      {i + 1}º
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                      {p.winningNumber != null ? (
                        <p className="text-xs text-primary font-semibold mt-0.5">
                          Ganhador: nº {p.winningNumber}
                          {p.winnerName ? ` · ${p.winnerName}` : ""}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5">Aguardando sorteio</p>
                      )}
                    </div>
                    {p.winningNumber != null && (
                      <span className="shrink-0 text-[10px] uppercase tracking-wider font-semibold bg-primary/15 text-primary rounded-full px-2 py-0.5">
                        Sorteado
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
