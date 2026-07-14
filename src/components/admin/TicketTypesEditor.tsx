"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, GripVertical, Percent } from "lucide-react";
import { saveTicketTypes } from "@/app/actions/ticket-types";
import type { BundleTier } from "@/lib/promotions/bundle";

interface TierRow {
  games: string;
  pct: string;
}

interface TypeRow {
  name: string;
  description: string;
  price: string; // em reais (string do input)
  combo: TierRow[];
}

interface Props {
  scope: string | null; // gameId ou null (catálogo global)
  initial: {
    name: string;
    description: string | null;
    priceCents: number;
    comboTiers: BundleTier[];
  }[];
  /** Texto explicativo quando a lista está vazia (ex.: por jogo usa o global). */
  emptyHint?: string;
}

export function TicketTypesEditor({ scope, initial, emptyHint }: Props) {
  const [rows, setRows] = useState<TypeRow[]>(
    initial.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      price: (t.priceCents / 100).toFixed(2),
      combo: (t.comboTiers ?? []).map((c) => ({
        games: String(c.games),
        pct: String(c.pct),
      })),
    }))
  );
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<TypeRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { name: "", description: "", price: "", combo: [] }]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addTier(i: number) {
    update(i, { combo: [...rows[i].combo, { games: "", pct: "" }] });
  }
  function updateTier(i: number, j: number, patch: Partial<TierRow>) {
    update(i, {
      combo: rows[i].combo.map((c, idx) => (idx === j ? { ...c, ...patch } : c)),
    });
  }
  function removeTier(i: number, j: number) {
    update(i, { combo: rows[i].combo.filter((_, idx) => idx !== j) });
  }

  function handleSave() {
    setError(null);
    const payload = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        description: r.description.trim() || null,
        priceCents: Math.round((parseFloat(r.price.replace(",", ".")) || 0) * 100),
        comboTiers: r.combo
          .map((c) => ({ games: Math.round(Number(c.games) || 0), pct: Math.round(Number(c.pct) || 0) }))
          .filter((c) => c.games >= 2 && c.pct > 0),
      }));
    startTransition(async () => {
      const res = await saveTicketTypes(scope, payload);
      if (res.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(res.error ?? "Erro ao salvar.");
      }
    });
  }

  const inputClass =
    "bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring w-full";

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 && emptyHint && (
        <p className="text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">
          {emptyHint}
        </p>
      )}

      {rows.map((r, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 border border-border rounded-xl p-3 bg-secondary/20"
        >
          <div className="flex items-start gap-2">
            <GripVertical size={14} className="text-muted-foreground/40 shrink-0 mt-3" />
            {/* Empilha no mobile (nome em largura cheia); inline no desktop. */}
            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2">
              <input
                className={`${inputClass} min-w-0 sm:flex-1`}
                placeholder="Nome do tipo (ex: Inteira, Meia, VIP)"
                value={r.name}
                maxLength={60}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:flex-none sm:w-32">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
                    R$
                  </span>
                  <input
                    className={`${inputClass} pl-9`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={r.price}
                    onChange={(e) => update(i, { price: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-2 shrink-0"
                  title="Remover tipo"
                  aria-label="Remover tipo"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
          <textarea
            className={inputClass}
            rows={2}
            maxLength={300}
            placeholder="Definição / quem tem direito (opcional) — ex: Estudantes e idosos 60+"
            value={r.description}
            onChange={(e) => update(i, { description: e.target.value })}
          />

          {/* Combo deste tipo */}
          <div className="border-t border-border/60 pt-2 mt-1">
            <p className="text-xs font-medium text-foreground mb-0.5">Combo deste tipo</p>
            <p className="text-[11px] text-muted-foreground mb-2">
              Desconto quando o cliente compra este tipo em vários jogos diferentes.
              Sem faixas = sem combo.
            </p>
            <div className="flex flex-col gap-1.5">
              {r.combo.map((c, j) => (
                <div key={j} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      className="bg-input border border-border rounded-md px-2 py-1.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring w-16 text-center"
                      type="number"
                      min="2"
                      step="1"
                      placeholder="2"
                      value={c.games}
                      onChange={(e) => updateTier(i, j, { games: e.target.value })}
                    />
                    <span className="text-xs text-muted-foreground">jogos →</span>
                  </div>
                  <div className="relative w-24">
                    <input
                      className="bg-input border border-border rounded-md px-2 py-1.5 pr-7 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring w-full"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      placeholder="10"
                      value={c.pct}
                      onChange={(e) => updateTier(i, j, { pct: e.target.value })}
                    />
                    <Percent size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTier(i, j)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1.5"
                    title="Remover faixa"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => addTier(i)}
              className="flex items-center gap-1 text-xs text-primary hover:opacity-80 mt-1.5"
            >
              <Plus size={12} /> Adicionar faixa de combo
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="flex items-center justify-center gap-1.5 border border-dashed border-border rounded-xl py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
      >
        <Plus size={15} /> Adicionar tipo
      </button>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="bg-primary text-primary-foreground rounded-lg px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Salvando..." : "Salvar Tipos"}
        </button>
        {saved && <span className="text-sm text-green-600">Salvo com sucesso!</span>}
      </div>
    </div>
  );
}
