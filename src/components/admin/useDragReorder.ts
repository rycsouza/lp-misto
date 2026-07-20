"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type React from "react";

export function useDragReorder<T extends { id: string }>(
  initial: T[],
  onReorder: (ids: string[]) => Promise<void>
) {
  const [rows, setRows] = useState(initial);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  // Re-sincroniza com os dados do servidor quando eles mudam (após router.refresh()
  // de uma ação: excluir, ativar/parar venda, definir ganhador, etc.). Sem isso o
  // estado local ficava "preso" e só um reload da página refletia a mudança.
  // Durante um arraste em andamento, não sobrescreve o estado otimista.
  useEffect(() => {
    if (dragIndex === null) setRows(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  async function persist(next: T[]) {
    setRows(next);
    setIsSaving(true);
    try {
      await onReorder(next.map((r) => r.id));
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDrop(dropIndex: number) {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...rows];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    setDragIndex(null);
    setOverIndex(null);
    await persist(next);
  }

  /** Reordenação por botões (↑/↓) — acessível no toque, sem depender de arrastar. */
  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[index], next[j]] = [next[j], next[index]];
    await persist(next);
  }

  function getRowProps(idx: number) {
    const isDragging = dragIndex === idx;
    const isOver = overIndex === idx && dragIndex !== null && dragIndex !== idx;
    return {
      draggable: true as const,
      onDragStart: () => setDragIndex(idx),
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setOverIndex(idx);
      },
      onDrop: () => handleDrop(idx),
      onDragEnd: () => {
        setDragIndex(null);
        setOverIndex(null);
      },
      className: [
        "border-b border-border/50 transition-colors select-none",
        isDragging ? "opacity-30" : "hover:bg-secondary/30",
        isOver ? "bg-primary/10 border-t-2 border-t-primary" : "",
      ].join(" "),
    };
  }

  return { rows, isSaving, move, getRowProps };
}
