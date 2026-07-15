"use client";

import { useTransition, useState } from "react";
import type React from "react";
import { GripVertical } from "lucide-react";
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
  // Ordenado pela `order` inicial; a partir daqui a ORDEM é a posição na lista
  // (arraste para reordenar), não mais um número digitado.
  const [sections, setSections] = useState(
    [...initial].sort((a, b) => a.order - b.order)
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function handleToggle(key: string) {
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s))
    );
  }

  function moveRow(from: number, to: number) {
    if (from === to) return;
    setSections((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function handleSave() {
    const updates: Record<string, string> = {};
    // A ordem persistida é a posição atual na lista (0, 1, 2, ...).
    sections.forEach((s, i) => {
      updates[`section.${s.key}.enabled`] = String(s.enabled);
      updates[`section.${s.key}.order`] = String(i);
    });

    startTransition(async () => {
      await updateConfigValues(updates);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Column headers */}
      <div className="flex items-center gap-3 px-3 pb-1 border-b border-border/50">
        <span className="w-5 shrink-0" />
        <span className="flex-1 text-xs text-muted-foreground font-medium uppercase tracking-wide">Seção</span>
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide w-16 text-center shrink-0">Visível</span>
      </div>

      <div className="flex flex-col gap-2">
        {sections.map((section, idx) => {
          const isDragging = dragIndex === idx;
          const isOver = overIndex === idx && dragIndex !== null && dragIndex !== idx;
          return (
            <div
              key={section.key}
              draggable
              onDragStart={() => setDragIndex(idx)}
              onDragOver={(e: React.DragEvent) => {
                e.preventDefault();
                setOverIndex(idx);
              }}
              onDrop={() => {
                if (dragIndex !== null) moveRow(dragIndex, idx);
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              className={`flex items-center gap-3 p-3 rounded-lg border bg-secondary/20 transition-colors select-none ${
                isDragging ? "opacity-40" : ""
              } ${isOver ? "border-primary bg-primary/10" : "border-border"}`}
            >
              <span
                className="shrink-0 text-muted-foreground/60 cursor-grab active:cursor-grabbing touch-none"
                aria-hidden="true"
                title="Arraste para reordenar"
              >
                <GripVertical size={18} />
              </span>

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
                  aria-label={`Exibir seção ${section.label}`}
                  className="w-5 h-5 cursor-pointer"
                />
              </div>
            </div>
          );
        })}
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
        Marque para exibir a seção no site e <b>arraste pela alça</b> para definir a ordem de exibição.
      </p>
    </div>
  );
}
