"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { saveTicketTypes } from "@/app/actions/ticket-types";

interface TypeRow {
  name: string;
  description: string;
  price: string; // em reais (string do input)
}

interface Props {
  scope: string | null; // gameId ou null (catálogo global)
  initial: { name: string; description: string | null; priceCents: number }[];
  /** Texto explicativo quando a lista está vazia (ex.: por jogo usa o global). */
  emptyHint?: string;
}

export function TicketTypesEditor({ scope, initial, emptyHint }: Props) {
  const [rows, setRows] = useState<TypeRow[]>(
    initial.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      price: (t.priceCents / 100).toFixed(2),
    }))
  );
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<TypeRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { name: "", description: "", price: "" }]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSave() {
    setError(null);
    const payload = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        description: r.description.trim() || null,
        priceCents: Math.round((parseFloat(r.price.replace(",", ".")) || 0) * 100),
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
          <div className="flex items-center gap-2">
            <GripVertical size={14} className="text-muted-foreground/40 shrink-0" />
            <input
              className={inputClass}
              placeholder="Nome do tipo (ex: Inteira, Meia, VIP)"
              value={r.name}
              maxLength={60}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <div className="relative w-32 shrink-0">
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
            >
              <Trash2 size={15} />
            </button>
          </div>
          <textarea
            className={inputClass}
            rows={2}
            maxLength={300}
            placeholder="Definição / quem tem direito (opcional) — ex: Estudantes e idosos 60+"
            value={r.description}
            onChange={(e) => update(i, { description: e.target.value })}
          />
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
