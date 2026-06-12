"use client";

import { useState } from "react";
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

  async function handleDrop(dropIndex: number) {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...rows];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    setRows(next);
    setDragIndex(null);
    setOverIndex(null);
    setIsSaving(true);
    try {
      await onReorder(next.map((r) => r.id));
      router.refresh();
    } finally {
      setIsSaving(false);
    }
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

  return { rows, isSaving, getRowProps };
}
