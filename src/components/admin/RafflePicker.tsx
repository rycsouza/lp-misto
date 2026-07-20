"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface RaffleOption {
  id: string;
  name: string;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "rascunho",
  active: "à venda",
  closed: "encerrada",
  drawn: "sorteada",
  cancelled: "cancelada",
};

/** Seletor de sorteio do relatório de rifas — navega mantendo a aba ativa. */
export function RafflePicker({ raffles, selected }: { raffles: RaffleOption[]; selected: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1 w-full sm:max-w-sm">
      <label htmlFor="rifa" className="text-xs text-muted-foreground">
        Sorteio
      </label>
      <div className="relative">
        <select
          id="rifa"
          name="rifa"
          value={selected}
          disabled={pending || raffles.length === 0}
          onChange={(e) => {
            const id = e.target.value;
            const qs = new URLSearchParams({ aba: "rifas" });
            if (id) qs.set("rifa", id);
            startTransition(() => router.push(`/admin/relatorios?${qs.toString()}`));
          }}
          className="form-select w-full bg-input border border-border rounded-md pl-3 pr-9 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        >
          {raffles.length === 0 && <option value="">Nenhum sorteio cadastrado</option>}
          {raffles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} · {STATUS_LABEL[r.status] ?? r.status}
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
