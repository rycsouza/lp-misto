import { getAdminGames } from "@/app/actions/admin";
import { GameActions } from "@/components/admin/GameActions";
import Link from "next/link";
import { Plus } from "lucide-react";

function formatGameDate(date: Date): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function JogosPage() {
  const games = await getAdminGames();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground tracking-wide">
          JOGOS
        </h2>
        <Link
          href="/admin/jogos/novo"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Novo Jogo
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Data
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Adversário
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Competição
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Rodada
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Mando
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-right text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {games.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center text-muted-foreground py-10"
                  >
                    Nenhum jogo cadastrado
                  </td>
                </tr>
              )}
              {games.map((game) => (
                <tr
                  key={game.id}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-4 py-3 text-foreground text-xs">
                    {formatGameDate(game.date)}
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium">
                    {game.opponent}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {game.competition}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {game.round}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        game.isHome
                          ? "text-green-600 text-xs font-medium"
                          : "text-muted-foreground text-xs"
                      }
                    >
                      {game.isHome ? "Casa" : "Fora"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        game.active
                          ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600"
                          : "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"
                      }
                    >
                      {game.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <GameActions gameId={game.id} isActive={game.active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
