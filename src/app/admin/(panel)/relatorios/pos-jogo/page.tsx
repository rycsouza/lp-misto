export const dynamic = "force-dynamic";

import Link from "next/link";
import { Users, Ticket, Percent, UserX, TrendingUp, Star, Clock } from "lucide-react";
import { getHomeGamesForValidation, getPostGameReport } from "@/app/actions/validations";
import { getSiteConfig } from "@/lib/config";

function brl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function fmtGameDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

interface PageProps {
  searchParams: Promise<{ game?: string }>;
}

export default async function PosJogoPage({ searchParams }: PageProps) {
  const { game: gameParam } = await searchParams;
  const [games, siteName] = await Promise.all([
    getHomeGamesForValidation(),
    getSiteConfig().then((c) => c.siteName || "Mandante").catch(() => "Mandante"),
  ]);

  // Default: jogo em casa mais recente que já começou (ou o mais recente da lista).
  const nowIso = new Date().toISOString();
  const past = games.filter((g) => g.date <= nowIso);
  const defaultGameId = gameParam || past[0]?.id || games[0]?.id || "";

  const report = defaultGameId ? await getPostGameReport(defaultGameId) : null;

  const pct = report ? Math.round(report.attendanceRate * 100) : 0;

  const kpis = report
    ? [
        { label: "Público presente", value: String(report.validated), icon: Users, accent: "text-green-600" },
        { label: "Ingressos emitidos", value: String(report.emitted), icon: Ticket, accent: "text-foreground" },
        { label: "Comparecimento", value: `${pct}%`, icon: Percent, accent: "text-foreground" },
        { label: "No-show", value: String(report.noShow), icon: UserX, accent: "text-foreground" },
        { label: "Receita (ingressos)", value: brl(report.revenueCents), icon: TrendingUp, accent: "text-green-600" },
      ]
    : [];

  const maxHour = report ? Math.max(1, ...report.timeline.map((t) => t.count)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-xl text-foreground tracking-wide">RELATÓRIO PÓS-JOGO</h2>

        <form className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="game" className="text-xs text-muted-foreground block mb-1">
              Jogo (mando de casa)
            </label>
            <select
              id="game"
              name="game"
              defaultValue={defaultGameId}
              className="bg-input border border-border rounded-md px-3 py-1.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring max-w-[70vw] sm:max-w-xs"
            >
              {games.length === 0 && <option value="">Nenhum jogo em casa</option>}
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.opponent} · {new Date(g.date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Ver relatório
          </button>
        </form>
      </div>

      {!report ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
          Selecione um jogo em casa para ver o relatório.
        </div>
      ) : (
        <>
          {/* Identificação do jogo */}
          <div className="bg-card border border-border rounded-xl px-5 py-4">
            <p className="text-lg font-bold text-foreground">
              {report.game.competition} · {siteName} <span className="text-muted-foreground">×</span> {report.game.opponent}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {report.game.round} · {fmtGameDate(report.game.date)} · {report.game.venue}
            </p>
          </div>

          {!report.hasData ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-foreground font-medium">Sem ingressos/validações registrados para este jogo.</p>
              <p className="text-muted-foreground text-sm mt-1">
                Os números aparecem conforme os ingressos são vendidos e validados na portaria.
              </p>
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {kpis.map((k) => {
                  const Icon = k.icon;
                  return (
                    <div key={k.label} className="bg-card border border-border rounded-xl p-5">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</p>
                        <Icon size={15} className="text-muted-foreground/60" />
                      </div>
                      <p className={`text-lg sm:text-2xl font-bold ${k.accent}`}>{k.value}</p>
                    </div>
                  );
                })}
              </div>

              {/* Destaque VIP — Área Exclusiva */}
              {report.vipEmitted > 0 && (
                <div className="bg-orange-500/10 border border-orange-500/40 rounded-xl px-5 py-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/20 flex items-center justify-center shrink-0">
                    <Star size={24} className="text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-wider text-orange-600 font-semibold">Área Exclusiva (VIP)</p>
                    <p className="text-foreground">
                      <span className="text-2xl font-bold text-orange-500">{report.vipPresent}</span>
                      <span className="text-muted-foreground"> presentes de {report.vipEmitted} emitidos</span>
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Por tipo de ingresso */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <h3 className="font-semibold text-foreground px-5 py-3 border-b border-border">
                    Comparecimento por tipo
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30 text-xs text-muted-foreground uppercase tracking-wider">
                        <th className="text-left px-4 py-2.5">Tipo</th>
                        <th className="text-right px-2 py-2.5">Emit.</th>
                        <th className="text-right px-2 py-2.5">Pres.</th>
                        <th className="text-right px-2 py-2.5">No-show</th>
                        <th className="text-right px-4 py-2.5">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byType.map((t) => {
                        const tpct = t.emitted > 0 ? Math.round((t.validated / t.emitted) * 100) : 0;
                        return (
                          <tr
                            key={t.typeCode + t.typeName}
                            className={`border-b border-border/50 last:border-0 ${t.vip ? "bg-orange-500/5" : ""}`}
                          >
                            <td className="px-4 py-2.5 text-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                {t.vip && <Star size={12} className="text-orange-500 shrink-0" />}
                                {t.typeName}
                              </span>
                            </td>
                            <td className="px-2 py-2.5 text-right text-muted-foreground tabular-nums">{t.emitted}</td>
                            <td className="px-2 py-2.5 text-right font-semibold text-foreground tabular-nums">{t.validated}</td>
                            <td className="px-2 py-2.5 text-right text-muted-foreground tabular-nums">{t.noShow}</td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">{tpct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pago x cortesia + operadores + janela */}
                <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-5">
                  <div>
                    <h3 className="font-semibold text-foreground mb-3">Pago × cortesia</h3>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs bg-secondary text-foreground rounded-full px-3 py-1">
                        Pagos: <b>{report.paidTickets}</b>
                      </span>
                      <span className="text-xs bg-secondary text-foreground rounded-full px-3 py-1">
                        Cortesias: <b>{report.courtesyTickets}</b>
                      </span>
                      {report.cancelled > 0 && (
                        <span className="text-xs bg-secondary text-foreground rounded-full px-3 py-1">
                          Cancelados: <b>{report.cancelled}</b>
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-3">Validações por operador</h3>
                    {report.byOperator.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma validação registrada.</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {report.byOperator.map((o) => (
                          <li key={o.name} className="flex items-center justify-between text-sm">
                            <span className="text-foreground truncate">{o.name}</span>
                            <span className="text-muted-foreground tabular-nums shrink-0 ml-3">{o.count}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {(report.firstValidation || report.lastValidation) && (
                    <div>
                      <h3 className="font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <Clock size={14} className="text-muted-foreground" /> Janela de validação
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {report.firstValidation ? fmtTime(report.firstValidation) : "—"} →{" "}
                        {report.lastValidation ? fmtTime(report.lastValidation) : "—"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Fluxo de validação por hora */}
              {report.timeline.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-foreground mb-4">Fluxo de entrada por hora</h3>
                  <div className="flex items-end gap-2 h-40">
                    {report.timeline.map((t) => (
                      <div key={t.hour} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                        <span className="text-xs font-semibold text-foreground tabular-nums">{t.count}</span>
                        <div
                          className="w-full bg-primary/70 rounded-t-md"
                          style={{ height: `${Math.max(4, (t.count / maxHour) * 120)}px` }}
                        />
                        <span className="text-[10px] text-muted-foreground tabular-nums">{t.hour}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <p className="text-xs text-muted-foreground">
            Dados de comparecimento a partir das validações de portaria (1 QR por ingresso).{" "}
            <Link href="/admin/relatorios" className="text-primary hover:underline">
              Ver relatório de vendas
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
