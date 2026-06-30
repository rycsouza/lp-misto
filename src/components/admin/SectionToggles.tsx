"use client";

import { useTransition, useState } from "react";
import { updateConfigValues } from "@/app/actions/admin";

interface SectionMeta {
  key: string;
  label: string;
  enabled: boolean;
  order: number;
}

interface SectionTogglesProps {
  sections: SectionMeta[];
}

export function SectionToggles({ sections: initial }: SectionTogglesProps) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [sections, setSections] = useState(initial);

  function handleToggle(key: string) {
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s))
    );
  }

  function handleOrderChange(key: string, value: string) {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, order: num } : s))
    );
  }

  function handleSave() {
    const updates: Record<string, string> = {};
    for (const s of sections) {
      updates[`section.${s.key}.enabled`] = String(s.enabled);
      updates[`section.${s.key}.order`] = String(s.order);
    }

    startTransition(async () => {
      await updateConfigValues(updates);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Column headers */}
      <div className="flex items-center gap-4 px-3 pb-1 border-b border-border/50">
        <span className="flex-1 text-xs text-muted-foreground font-medium uppercase tracking-wide">Seção</span>
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide w-16 text-center shrink-0">Visível</span>
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide w-20 text-right shrink-0">Ordem</span>
      </div>

      <div className="flex flex-col gap-2">
        {sections.map((section) => (
          <div
            key={section.key}
            className="flex items-center gap-4 p-3 rounded-lg border border-border bg-secondary/20"
          >
            <div className="flex-1 min-w-0">
              <span className="text-sm text-foreground">{section.label}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline ml-2">
                ({section.key})
              </span>
            </div>

            {/* Visibility toggle */}
            <div className="w-16 flex justify-center shrink-0">
              <input
                type="checkbox"
                checked={section.enabled}
                onChange={() => handleToggle(section.key)}
                className="w-4 h-4 cursor-pointer"
              />
            </div>

            {/* Order */}
            <div className="w-20 flex items-center justify-end gap-1.5 shrink-0">
              <input
                type="number"
                min="0"
                value={section.order}
                onChange={(e) => handleOrderChange(section.key, e.target.value)}
                className="bg-input border border-border rounded px-2 py-1 text-sm text-foreground w-16 outline-none focus:ring-1 focus:ring-ring text-right"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="bg-primary text-primary-foreground rounded-lg px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Salvando..." : "Salvar Seções"}
        </button>
        {saved && (
          <span className="text-sm text-green-600">Salvo com sucesso!</span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Marque para exibir a seção no site; defina a ordem de exibição na coluna ao lado.
      </p>
    </div>
  );
}
