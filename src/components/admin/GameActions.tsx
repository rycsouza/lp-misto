"use client";

import { useTransition, useState } from "react";
import { toggleGameActive, deleteGame, duplicateGame } from "@/app/actions/admin";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Edit, Trash2, Eye, EyeOff, Copy, AlertTriangle } from "lucide-react";

interface GameActionsProps {
  gameId: string;
  isActive: boolean;
}

export function GameActions({ gameId, isActive }: GameActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const router = useRouter();

  function handleToggle() {
    startTransition(async () => {
      await toggleGameActive(gameId, !isActive);
    });
  }

  function handleConfirmDelete() {
    startTransition(async () => {
      const res = await deleteGame(gameId);
      setConfirmOpen(false);
      // Jogo com ingressos/pedidos vinculados não pode ser excluído (a FK de
      // tickets é cascade) — orientamos a desativar em vez de excluir.
      if (!res.success && res.error === "in_use") {
        setBlockedOpen(true);
      }
    });
  }

  function handleDeactivateFromBlocked() {
    setBlockedOpen(false);
    if (isActive) handleToggle();
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateGame(gameId);
      if (result.success && result.id) {
        router.push(`/admin/jogos/${result.id}`);
      }
    });
  }

  // Alvo de toque maior no mobile (p-2 = ~44px de área); desktop mais compacto.
  const iconBtn =
    "p-2 sm:p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50";

  return (
    <>
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={handleToggle}
          disabled={isPending}
          title={isActive ? "Desativar" : "Ativar"}
          aria-label={isActive ? "Desativar jogo" : "Ativar jogo"}
          className={iconBtn}
        >
          {isActive ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <button
          onClick={handleDuplicate}
          disabled={isPending}
          title="Duplicar jogo"
          aria-label="Duplicar jogo"
          className={iconBtn}
        >
          <Copy size={16} />
        </button>
        <Link
          href={`/admin/jogos/${gameId}`}
          className={iconBtn}
          title="Editar"
          aria-label="Editar jogo"
        >
          <Edit size={16} />
        </Link>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={isPending}
          title="Excluir"
          aria-label="Excluir jogo"
          className="p-2 sm:p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Excluir jogo?"
        description="Esta ação é permanente. Só é possível excluir jogos sem ingressos ou pedidos vinculados — se houver vendas, desative o jogo em vez de excluir."
        confirmLabel="Excluir"
        isPending={isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Bloqueio: jogo com vínculos não pode ser excluído — oferece desativar. */}
      {blockedOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setBlockedOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="shrink-0 w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center mt-0.5">
                <AlertTriangle size={15} className="text-amber-500" />
              </div>
              <div>
                <h3 className="text-foreground font-semibold text-sm">Não é possível excluir</h3>
                <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                  Este jogo já tem ingressos ou pedidos vinculados. Para tirá-lo do site sem
                  perder o histórico, desative-o.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setBlockedOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                Fechar
              </button>
              {isActive && (
                <button
                  onClick={handleDeactivateFromBlocked}
                  disabled={isPending}
                  className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
                >
                  Desativar jogo
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
