"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface GameOption {
  id: string;
  opponent: string;
  date: string;
}

/**
 * Seletor de jogo do relatório pós-jogo. Filtra na hora que troca a seleção
 * (sem botão "Ver relatório") — navega para a mesma tela mantendo a aba ativa.
 */
export function GamePicker({ games, selected }: { games: GameOption[]; selected: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1 w-full sm:max-w-sm">
      <label htmlFor="game" className="text-xs text-muted-foreground">
        Jogo (mando de casa)
      </label>
      <div className="relative">
        <select
          id="game"
          name="game"
          defaultValue={selected}
          disabled={pending || games.length === 0}
          onChange={(e) => {
            const id = e.target.value;
            const qs = new URLSearchParams({ aba: "pos-jogo" });
            if (id) qs.set("game", id);
            startTransition(() => router.push(`/admin/relatorios?${qs.toString()}`));
          }}
          className="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        >
          {games.length === 0 && <option value="">Nenhum jogo em casa</option>}
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.opponent} · {new Date(g.date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </option>
          ))}
        </select>
        {pending && (
          <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            Carregando…
          </span>
        )}
      </div>
    </div>
  );
}
