"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown } from "lucide-react";

interface ReorderButtonsProps {
  onMoveUp: () => Promise<void>;
  onMoveDown: () => Promise<void>;
  isFirst: boolean;
  isLast: boolean;
}

export function ReorderButtons({
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: ReorderButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleUp() {
    if (isFirst) return;
    startTransition(async () => {
      await onMoveUp();
      router.refresh();
    });
  }

  function handleDown() {
    if (isLast) return;
    startTransition(async () => {
      await onMoveDown();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={handleUp}
        disabled={isFirst || isPending}
        title="Mover para cima"
        aria-label="Subir"
        className="p-2 sm:p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        onClick={handleDown}
        disabled={isLast || isPending}
        title="Mover para baixo"
        aria-label="Descer"
        className="p-2 sm:p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronDown size={14} />
      </button>
    </div>
  );
}
