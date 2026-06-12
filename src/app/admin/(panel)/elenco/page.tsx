import {
  getAdminPlayers,
  getCurrentSeason,
} from "@/app/actions/admin-content";
import { PlayerActions } from "@/components/admin/PlayerActions";
import Link from "next/link";
import { Plus, User } from "lucide-react";

const positionLabels: Record<string, string> = {
  goleiro: "Goleiro",
  zagueiro: "Zagueiro",
  lateral: "Lateral",
  volante: "Volante",
  meia: "Meia",
  atacante: "Atacante",
};

const positionColors: Record<string, string> = {
  goleiro: "bg-amber-500/15 text-amber-600",
  zagueiro: "bg-blue-500/15 text-blue-600",
  lateral: "bg-cyan-500/15 text-cyan-600",
  volante: "bg-purple-500/15 text-purple-600",
  meia: "bg-green-500/15 text-green-600",
  atacante: "bg-red-500/15 text-red-600",
};

interface PageProps {
  searchParams: Promise<{
    season?: string;
    position?: string;
    search?: string;
  }>;
}

export default async function ElencoPage({ searchParams }: PageProps) {
  const { season, position, search } = await searchParams;
  const currentSeason = await getCurrentSeason();
  const seasonNum = season ? parseInt(season, 10) : undefined;

  const players = await getAdminPlayers({
    season: seasonNum,
    position,
    search,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground tracking-wide">
          ELENCO
        </h2>
        <Link
          href="/admin/elenco/novo"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Novo Jogador
        </Link>
      </div>

      {/* Filters */}
      <form method="get" action="/admin/elenco" className="flex flex-wrap gap-3">
        <input
          name="search"
          type="text"
          defaultValue={search ?? ""}
          placeholder="Buscar por nome..."
          className="bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring min-w-[180px]"
        />
        <input
          name="season"
          type="number"
          defaultValue={season ?? String(currentSeason)}
          placeholder="Temporada"
          min={2000}
          max={2100}
          className="bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring w-32"
        />
        <select
          name="position"
          defaultValue={position ?? ""}
          className="bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todas as posições</option>
          {Object.entries(positionLabels).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80"
        >
          Filtrar
        </button>
        {(search || position || season) && (
          <Link
            href="/admin/elenco"
            className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80"
          >
            Limpar
          </Link>
        )}
      </form>

      {players.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground">
          Nenhum jogador encontrado
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {players.map((player) => (
            <div
              key={player.id}
              className={`bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-3 ${!player.active ? "opacity-50" : ""}`}
            >
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
                {player.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={player.photoUrl}
                    alt={player.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={28} className="text-muted-foreground" />
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground leading-tight">
                  {player.name}
                </p>
                {player.number != null && (
                  <p className="text-xs text-muted-foreground">
                    #{player.number}
                  </p>
                )}
                <span
                  className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${positionColors[player.position] ?? "bg-muted text-muted-foreground"}`}
                >
                  {positionLabels[player.position] ?? player.position}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  {player.season}
                </p>
              </div>
              <PlayerActions playerId={player.id} isActive={player.active} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
