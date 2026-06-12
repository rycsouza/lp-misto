"use client";

import { useTransition } from "react";
import { togglePlayerActive, deletePlayer } from "@/app/actions/admin-content";
import Link from "next/link";
import { Edit, Trash2, Eye, EyeOff } from "lucide-react";

interface PlayerActionsProps {
  playerId: string;
  isActive: boolean;
}

export function PlayerActions({ playerId, isActive }: PlayerActionsProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await togglePlayerActive(playerId, !isActive);
    });
  }

  function handleDelete() {
    if (!confirm("Tem certeza que deseja desativar este jogador?")) return;
    startTransition(async () => {
      await deletePlayer(playerId);
    });
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleToggle}
        disabled={isPending}
        title={isActive ? "Desativar" : "Ativar"}
        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        {isActive ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      <Link
        href={`/admin/elenco/${playerId}`}
        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
        title="Editar"
      >
        <Edit size={14} />
      </Link>
      <button
        onClick={handleDelete}
        disabled={isPending}
        title="Excluir (soft delete)"
        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
