"use client";

import { Calendar, MapPin, Check } from "lucide-react";

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
  selectedGameIds: string[];
  onToggle: (gameId: string) => void;
  onNext: () => void;
}

export function GameSelect({ games, selectedGameIds, onToggle, onNext }: GameSelectProps) {
  return (
    <div>
      <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-2">
        {games.length === 1 ? "Escolha o Jogo" : "Escolha os Jogos"}
      </h2>
      {games.length > 1 && (
        <p className="text-muted-foreground text-sm mb-6">
          Selecione um ou mais jogos para comprar ingressos.
        </p>
      )}

      {games.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          Não há jogos disponíveis no momento.
        </p>
      ) : (
        <div className="space-y-3 mb-8">
          {games.map((game) => {
            const selected = selectedGameIds.includes(game.id);
            const d = new Date(game.date);
            return (
              <button
                key={game.id}
                onClick={() => onToggle(game.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selected
                    ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(193,154,90,0.2)]"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 shrink-0 transition-colors ${
                      selected ? "border-primary bg-primary" : "border-muted-foreground"
                    }`}
                  >
                    {selected && <Check size={11} className="text-primary-foreground" />}
                  </div>
                  <div>
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
                          timeZone: "America/Sao_Paulo",
                        })}{" "}
                        — {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {game.venue}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {game.competition} — {game.round}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={onNext}
        disabled={selectedGameIds.length === 0}
        className="w-full py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Continuar
      </button>
    </div>
  );
}
