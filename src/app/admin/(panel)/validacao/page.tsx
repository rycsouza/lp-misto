export const dynamic = "force-dynamic";

import Link from "next/link";
import { getHomeGamesForValidation, getGameValidationStats } from "@/app/actions/validations";
import { getSiteConfig } from "@/lib/config";
import { ScanLine, Ticket, Calendar } from "lucide-react";

function fmtDate(isoStr: string) {
  return new Date(isoStr).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

// "Passado" só quando o DIA do jogo (fuso SP) já terminou — assim o jogo de hoje
// continua em "Próximos jogos" durante toda a partida (não pula no kickoff).
function spDayKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function isPast(isoStr: string) {
  return spDayKey(new Date(isoStr)) < spDayKey(new Date());
}

export default async function ValidacaoPage() {
  const [games, config] = await Promise.all([
    getHomeGamesForValidation(),
    getSiteConfig(),
  ]);
  const matchLabel = (opponent: string) => (config.siteName ? `${config.siteName} vs ${opponent}` : opponent);

  // Fetch stats for all games in parallel
  const statsMap = Object.fromEntries(
    await Promise.all(
      games.map(async (g) => {
        const s = await getGameValidationStats(g.id);
        return [g.id, s] as const;
      })
    )
  );

  const upcoming = games.filter((g) => !isPast(g.date));
  const past = games.filter((g) => isPast(g.date));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <ScanLine size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground">
            Validação de Ingressos
          </h1>
          <p className="text-muted-foreground text-sm">Selecione o jogo para iniciar a validação na entrada</p>
        </div>
      </div>

      {upcoming.length > 0 && (
        <section>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-3">
            Próximos jogos
          </p>
          <div className="flex flex-col gap-3">
            {upcoming.map((game) => {
              const stats = statsMap[game.id];
              return (
                <Link
                  key={game.id}
                  href={`/admin/validacao/${game.id}`}
                  className="bg-card border border-primary/30 rounded-xl p-4 flex items-center gap-4 hover:border-primary transition-colors group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Ticket size={22} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{matchLabel(game.opponent)}</p>
                    <p className="text-xs text-muted-foreground truncate">{game.competition} · {fmtDate(game.date)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {stats.totalTickets > 0 && (
                      <>
                        <p className="text-lg font-bold text-primary tabular-nums">{stats.totalTickets}</p>
                        <p className="text-[10px] text-muted-foreground">validados</p>
                      </>
                    )}
                    <span className="text-xs text-primary font-medium group-hover:underline">Abrir →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-3">
            Jogos anteriores
          </p>
          <div className="flex flex-col gap-2">
            {past.map((game) => {
              const stats = statsMap[game.id];
              return (
                <Link
                  key={game.id}
                  href={`/admin/validacao/${game.id}`}
                  className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors opacity-70 hover:opacity-100"
                >
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                    <Calendar size={16} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">{matchLabel(game.opponent)}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(game.date)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-foreground tabular-nums">{stats.totalTickets}</p>
                    <p className="text-[10px] text-muted-foreground">validados</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {games.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Ticket size={40} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhum jogo em casa cadastrado.</p>
          <Link href="/admin/jogos/novo" className="text-primary text-sm underline mt-1 inline-block">
            Cadastrar jogo
          </Link>
        </div>
      )}
    </div>
  );
}
