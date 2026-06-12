"use client";

import { useTransition, useState } from "react";
import { deleteGateway, setActiveGateway } from "@/app/actions/admin";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { useRouter } from "next/navigation";

interface GatewayActionsProps {
  id: string;
  active: boolean;
}

export function GatewayActions({ id, active }: GatewayActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleConfirmDelete() {
    setConfirmOpen(false);
    setError(null);
    startTransition(async () => {
      const result = await deleteGateway(id);
      if (!result.success) {
        setError(result.error ?? "Erro ao remover gateway.");
      }
    });
  }

  function handleActivate() {
    startTransition(async () => {
      await setActiveGateway(id);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-col gap-1 items-end">
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/admin/configuracoes/gateways/${id}`)}
            disabled={isPending}
            className="text-xs text-primary hover:underline disabled:opacity-50"
          >
            Editar
          </button>
          {!active && (
            <button
              onClick={handleActivate}
              disabled={isPending}
              className="text-xs text-green-600 hover:underline disabled:opacity-50"
            >
              Ativar
            </button>
          )}
          {!active && (
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={isPending}
              className="text-xs text-destructive hover:underline disabled:opacity-50"
            >
              Remover
            </button>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <ConfirmModal
        open={confirmOpen}
        title="Remover gateway?"
        description="O gateway será removido permanentemente. Esta ação não pode ser desfeita."
        confirmLabel="Remover"
        isPending={isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
