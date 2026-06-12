"use client";

import { useTransition, useState } from "react";
import { toggleGameActive, deleteGame, duplicateGame } from "@/app/actions/admin";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Edit, Trash2, Eye, EyeOff, Copy } from "lucide-react";

interface GameActionsProps {
  gameId: string;
  isActive: boolean;
}

export function GameActions({ gameId, isActive }: GameActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const router = useRouter();

  function handleToggle() {
    startTransition(async () => {
      await toggleGameActive(gameId, !isActive);
    });
  }

  function handleConfirmDelete() {
    setConfirmOpen(false);
    startTransition(async () => {
      await deleteGame(gameId);
    });
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateGame(gameId);
      if (result.success && result.id) {
        router.push(`/admin/jogos/${result.id}`);
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleToggle}
          disabled={isPending}
          title={isActive ? "Desativar" : "Ativar"}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {isActive ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
        <button
          onClick={handleDuplicate}
          disabled={isPending}
          title="Duplicar jogo"
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <Copy size={15} />
        </button>
        <Link
          href={`/admin/jogos/${gameId}`}
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
        title="Desativar jogo?"
        description="O jogo ficará oculto no site. Você pode reativá-lo a qualquer momento."
        confirmLabel="Desativar"
        isPending={isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
