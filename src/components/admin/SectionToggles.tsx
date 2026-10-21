"use client";

import { useTransition, useState, useRef } from "react";
import type React from "react";
import { GripVertical, Pencil } from "lucide-react";
import { updateConfigValues } from "@/app/actions/admin";
import {
  isValidSectionLabelText,
  SECTION_LABEL_MAX_CHARS,
  SECTION_LABEL_MIN_CHARS,
  sectionLabelKey,
} from "@/lib/section-meta";

/** Uma seção como a aba Seções a recebe da página de configurações. */
export interface SectionToggleItem {
  key: string;
  /** Nome padrão da seção (usado quando não há rótulo do clube). */
  label: string;
  /** Rótulo personalizado do clube; "" = usa o padrão. */
  customLabel: string;
  enabled: boolean;
  order: number;
}

/** Dados que o lote de gravação precisa de cada seção, na ordem da lista. */
export interface SectionUpdateInput {
  key: string;
  enabled: boolean;
  customLabel: string;
}

/**
 * Lote gravado pela aba Seções: enabled, order (= posição na lista) e o rótulo (vazio = padrão)
 * de cada seção. Função pura, para o teste.
 */
export function buildSectionUpdates(sections: readonly SectionUpdateInput[]): Record<string, string> {
  const updates: Record<string, string> = {};
  sections.forEach((s, i) => {
    updates[`section.${s.key}.enabled`] = String(s.enabled);
    updates[`section.${s.key}.order`] = String(i);
    updates[sectionLabelKey(s.key)] = s.customLabel;
  });
  return updates;
}

export const SECTION_LABEL_HINT = `Use de ${SECTION_LABEL_MIN_CHARS} a ${SECTION_LABEL_MAX_CHARS} caracteres: letras, números, espaço, hífen ou apóstrofo.`;

/**
 * Valida o texto digitado no campo de nome. Vazio volta ao padrão (ok, valor ""). Senão o texto
 * é trimado e precisa ser um rótulo válido. Função pura, para o teste.
 */
export function validateSectionLabelDraft(draft: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = draft.trim();
  if (value === "") return { ok: true, value: "" };
  if (isValidSectionLabelText(value)) return { ok: true, value };
  return { ok: false, error: SECTION_LABEL_HINT };
}

export function SectionToggles({ sections: initial }: { sections: SectionToggleItem[] }) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Ordenado pela `order` inicial; a partir daqui a ORDEM é a posição na lista
  // (arraste para reordenar), não mais um número digitado.
  const [sections, setSections] = useState(
    [...initial].sort((a, b) => a.order - b.order)
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // Edição inline do nome: a chave da seção em edição, o texto digitado e o erro de validação.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  // Esc cancela: o blur que vem depois não pode gravar o texto descartado.
  const cancelRef = useRef(false);

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

  function startEdit(section: SectionToggleItem) {
    cancelRef.current = false;
    setEditingKey(section.key);
    setDraft(section.customLabel);
    setDraftError(null);
  }

  function cancelEdit() {
    cancelRef.current = true;
    setEditingKey(null);
    setDraft("");
    setDraftError(null);
  }

  function commitEdit() {
    if (editingKey === null) return;
    const result = validateSectionLabelDraft(draft);
    if (!result.ok) {
      // Fica no campo com a dica; o clube corrige ou usa Esc.
      setDraftError(result.error);
      return;
    }
    const value = result.value;
    setSections((prev) => prev.map((s) => (s.key === editingKey ? { ...s, customLabel: value } : s)));
    setEditingKey(null);
    setDraft("");
    setDraftError(null);
  }

  function handleSave() {
    const updates = buildSectionUpdates(
      sections.map((s) => ({ key: s.key, enabled: s.enabled, customLabel: s.customLabel })),
    );
    setSaveError(null);

    startTransition(async () => {
      try {
        await updateConfigValues(updates);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch {
        // O servidor recusa o lote inteiro se algum nome for inválido: nada é gravado.
        setSaveError("Não foi possível salvar. Confira os nomes das seções.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Column headers */}
      <div className="flex items-center gap-3 px-3 pb-1 border-b border-border/50">
        <span className="w-5 shrink-0" />
        <span className="flex-1 text-xs text-muted-foreground font-medium uppercase tracking-wide">Seção</span>
        <span className="w-8 shrink-0" />
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide w-16 text-center shrink-0">Visível</span>
      </div>

      <div className="flex flex-col gap-2">
        {sections.map((section, idx) => {
          const isDragging = dragIndex === idx;
          const isOver = overIndex === idx && dragIndex !== null && dragIndex !== idx;
          const isEditing = editingKey === section.key;
          const shownName = section.customLabel || section.label;
          return (
            <div
              key={section.key}
              draggable={!isEditing}
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
                {isEditing ? (
                  <div className="flex flex-col gap-1">
                    <input
                      type="text"
                      autoFocus
                      value={draft}
                      maxLength={SECTION_LABEL_MAX_CHARS}
                      placeholder={section.label}
                      aria-label={`Nome da seção ${section.label}`}
                      aria-invalid={draftError !== null}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        setDraftError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitEdit();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          cancelEdit();
                        }
                      }}
                      onBlur={() => {
                        if (cancelRef.current) {
                          cancelRef.current = false;
                          return;
                        }
                        commitEdit();
                      }}
                      className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                    />
                    {draftError && (
                      <span role="alert" className="text-xs text-destructive">
                        {draftError}
                      </span>
                    )}
                  </div>
                ) : (
                  <div>
                    <span className="text-sm text-foreground">{shownName}</span>
                    {section.customLabel && (
                      <span className="text-xs text-muted-foreground ml-2">(padrão: {section.label})</span>
                    )}
                    <span className="text-xs text-muted-foreground hidden sm:inline ml-2">
                      ({section.key})
                    </span>
                  </div>
                )}
              </div>

              {/* Editar o nome exibido no site (título da seção e link do menu) */}
              <button
                type="button"
                onClick={() => startEdit(section)}
                disabled={isEditing}
                aria-label={`Editar nome da seção ${section.label}`}
                title="Editar nome da seção"
                className="w-8 h-8 flex items-center justify-center shrink-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30"
              >
                <Pencil size={16} aria-hidden="true" />
              </button>

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
        {saveError && (
          <span role="alert" className="text-sm text-destructive">{saveError}</span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Marque para exibir a seção no site, <b>arraste pela alça</b> para definir a ordem de exibição e use o
        lápis para trocar o nome exibido (vazio volta ao padrão). O mural dos sócios é uma seção própria:
        some se o módulo de sócios estiver desligado pela plataforma.
      </p>
    </div>
  );
}
