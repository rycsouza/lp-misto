"use client";

import { useTransition } from "react";
import { updateOrderStatusAdmin } from "@/app/actions/admin";

interface OrderActionsProps {
  orderId: string;
  currentStatus: string;
}

export function OrderActions({ orderId, currentStatus }: OrderActionsProps) {
  const [isPending, startTransition] = useTransition();

  function handleAction(status: "paid" | "cancelled" | "refunded") {
    if (!confirm(`Tem certeza que deseja marcar este pedido como "${status}"?`)) return;
    startTransition(async () => {
      await updateOrderStatusAdmin(orderId, status);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {currentStatus !== "paid" && (
        <button
          onClick={() => handleAction("paid")}
          disabled={isPending}
          className="bg-green-600/10 border border-green-600/30 text-green-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-600/20 transition-colors disabled:opacity-50"
        >
          Marcar como Pago
        </button>
      )}
      {currentStatus !== "cancelled" && currentStatus !== "refunded" && (
        <button
          onClick={() => handleAction("cancelled")}
          disabled={isPending}
          className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-2 text-sm font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50"
        >
          Cancelar Pedido
        </button>
      )}
      {currentStatus === "paid" && (
        <button
          onClick={() => handleAction("refunded")}
          disabled={isPending}
          className="bg-blue-500/10 border border-blue-500/30 text-blue-500 rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50"
        >
          Reembolsar
        </button>
      )}
      {isPending && (
        <span className="text-sm text-muted-foreground py-2">
          Atualizando...
        </span>
      )}
    </div>
  );
}
