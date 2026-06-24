export const dynamic = "force-dynamic";

import { getAdminGames } from "@/app/actions/admin";
import { GameActions } from "@/components/admin/GameActions";
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";

const LIMIT = 20;

function formatGameDate(date: Date): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

interface PageProps {
  searchParams: Promise<{ season?: string; search?: string; page?: string }>;
}

export default async function JogosPage({ searchParams }: PageProps) {
  const { season, search, page } = await searchParams;
  const seasonNum = season ? parseInt(season, 10) : undefined;
  const currentPage = Number(page ?? 1);

  const { rows: games, total } = await getAdminGames({ season: seasonNum, search, page: currentPage, limit: LIMIT });
  const totalPages = Math.ceil(total / LIMIT);

  function buildUrl(overrides: Record<string, string | number | undefined>) {
    const p = new URLSearchParams();
    const merged = { season: season ?? "", search: search ?? "", page: currentPage, ...overrides };
    if (merged.season) p.set("season", String(merged.season));
    if (merged.search) p.set("search", String(merged.search));
    if (Number(merged.page) > 1) p.set("page", String(merged.page));
    const qs = p.toString();
    return `/admin/jogos${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground tracking-wide">JOGOS</h2>
        <Link href="/admin/jogos/novo"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity">
          <Plus size={16} />Novo Jogo
        </Link>
      </div>

      <form method="get" action="/admin/jogos" className="flex flex-wrap gap-3">
        <input name="search" type="text" defaultValue={search ?? ""} placeholder="Buscar por adversário, competição ou rodada..."
          className="bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring flex-1 min-w-[200px]" />
        <input name="season" type="number" defaultValue={season ?? ""} placeholder="Temporada" min={2000} max={2100}
          className="bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring w-32" />
        <button type="submit" className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80">Filtrar</button>
        {(search || season) && (
          <Link href="/admin/jogos" className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80">Limpar</Link>
        )}
      </form>

      <div className="bg-card border border-border rounded-xl overflow-hidden">

        {/* ── Mobile cards ─────────────────────────────────── */}
        <div className="md:hidden divide-y divide-border/50">
          {games.length === 0 && (
            <p className="text-center text-muted-foreground py-10 text-sm">Nenhum jogo encontrado</p>
          )}
          {games.map((game) => (
            <div key={game.id} className="px-4 py-3 flex flex-col gap-1.5 hover:bg-secondary/20 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <p className="text-foreground font-semibold text-sm">{game.opponent}</p>
                <div className="flex items-center gap-1.5">
                  <span className={game.isHome ? "text-green-600 text-xs font-medium" : "text-muted-foreground text-xs"}>
                    {game.isHome ? "Casa" : "Fora"}
                  </span>
                  <span className={game.active
                    ? "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600"
                    : "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"}>
                    {game.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs">{game.competition} · {game.round}</span>
                <span className="text-muted-foreground text-xs">{formatGameDate(game.date)}</span>
              </div>
              <div className="flex justify-end">
                <GameActions gameId={game.id} isActive={game.active} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Desktop table ─────────────────────────────────── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Data</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Adversário</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Competição</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Rodada</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Mando</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-right text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {games.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-10">Nenhum jogo encontrado</td></tr>
              )}
              {games.map((game) => (
                <tr key={game.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 text-foreground text-xs">{formatGameDate(game.date)}</td>
                  <td className="px-4 py-3 text-foreground font-medium">{game.opponent}</td>
                  <td className="px-4 py-3 text-muted-foreground">{game.competition}</td>
                  <td className="px-4 py-3 text-muted-foreground">{game.round}</td>
                  <td className="px-4 py-3">
                    <span className={game.isHome ? "text-green-600 text-xs font-medium" : "text-muted-foreground text-xs"}>
                      {game.isHome ? "Casa" : "Fora"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={game.active
                      ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600"
                      : "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"}>
                      {game.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right"><GameActions gameId={game.id} isActive={game.active} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{total} jogo{total !== 1 ? "s" : ""} · Página {currentPage} de {totalPages}</span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link href={buildUrl({ page: currentPage - 1 })}
                className="flex items-center gap-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground hover:bg-secondary/80">
                <ChevronLeft size={14} />Anterior
              </Link>
            )}
            {currentPage < totalPages && (
              <Link href={buildUrl({ page: currentPage + 1 })}
                className="flex items-center gap-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground hover:bg-secondary/80">
                Próxima<ChevronRight size={14} />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
