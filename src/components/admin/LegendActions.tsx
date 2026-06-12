"use client";

import { useTransition, useState } from "react";
import { toggleLegendActive, deleteLegend } from "@/app/actions/admin-institutional";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import Link from "next/link";
import { Edit, Trash2, Eye, EyeOff } from "lucide-react";

interface LegendActionsProps {
  legendId: string;
  isActive: boolean;
}

export function LegendActions({ legendId, isActive }: LegendActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleToggle() {
    startTransition(async () => {
      await toggleLegendActive(legendId, !isActive);
    });
  }

  function handleConfirmDelete() {
    setConfirmOpen(false);
    startTransition(async () => {
      await deleteLegend(legendId);
    });
  }

  return (
    <>
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={handleToggle}
          disabled={isPending}
          title={isActive ? "Desativar" : "Ativar"}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {isActive ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
        <Link
          href={`/admin/lendas/${legendId}`}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          title="Editar"
        >
          <Edit size={15} />
        </Link>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={isPending}
          title="Excluir"
          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <ConfirmModal
        open={confirmOpen}
        title="Desativar lenda?"
        description="A lenda ficará oculta no site. Você pode reativá-la a qualquer momento."
        confirmLabel="Desativar"
        isPending={isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
