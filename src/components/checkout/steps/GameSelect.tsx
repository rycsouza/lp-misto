"use client";

import { Calendar, MapPin } from "lucide-react";

interface Game {
  id: string;
  opponent: string;
  date: string;
  venue: string;
  competition: string;
  round: string;
}

interface GameSelectProps {
  games: Game[];
  selectedGameId: string | null;
  onSelect: (gameId: string) => void;
  onNext: () => void;
}

export function GameSelect({ games, selectedGameId, onSelect, onNext }: GameSelectProps) {
  return (
    <div>
      <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-6">
        Escolha o Jogo
      </h2>

      {games.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          Não há jogos disponíveis no momento.
        </p>
      ) : (
        <div className="space-y-3 mb-8">
          {games.map((game) => {
            const d = new Date(game.date);
            return (
              <button
                key={game.id}
                onClick={() => onSelect(game.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedGameId === game.id
                    ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(193,154,90,0.2)]"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div className="font-[family-name:var(--font-bebas-neue)] text-xl text-foreground mb-1">
                  Misto EC vs {game.opponent}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    {d.toLocaleDateString("pt-BR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                    })}{" "}
                    — {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={14} />
                    {game.venue}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {game.competition} — {game.round}
                </p>
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!selectedGameId}
        className="w-full py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Continuar
      </button>
    </div>
  );
}
