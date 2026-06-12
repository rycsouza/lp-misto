"use client";

import { useTransition, useState } from "react";
import { deleteGateway, setActiveGateway } from "@/app/actions/admin";
import { useRouter } from "next/navigation";

interface GatewayActionsProps {
  id: string;
  active: boolean;
}

export function GatewayActions({ id, active }: GatewayActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleDelete() {
    if (!confirm("Tem certeza que deseja remover este gateway?")) return;
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
            onClick={handleDelete}
            disabled={isPending}
            className="text-xs text-destructive hover:underline disabled:opacity-50"
          >
            Remover
          </button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
