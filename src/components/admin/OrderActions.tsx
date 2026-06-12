"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelOrder } from "@/app/actions/admin";
import { XCircle } from "lucide-react";

interface OrderActionsProps {
  orderId: string;
  currentStatus: string;
}

const FINAL_STATUSES = new Set(["cancelled", "refunded"]);

export function OrderActions({ orderId, currentStatus }: OrderActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (FINAL_STATUSES.has(currentStatus)) return null;

  const confirmMessage =
    currentStatus === "paid"
      ? "Este pedido foi pago. Deseja cancelar e reembolsar o cliente via gateway de pagamento?"
      : "Deseja cancelar este pedido pendente?";

  function handleCancel() {
    if (!confirm(confirmMessage)) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelOrder(orderId);
      if (!result.success) {
        setError(result.error ?? "Erro ao cancelar pedido.");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleCancel}
        disabled={isPending}
        className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-2 text-sm font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50 w-fit"
      >
        <XCircle size={15} />
        {isPending
          ? "Cancelando..."
          : currentStatus === "paid"
          ? "Cancelar e Reembolsar"
          : "Cancelar Pedido"}
      </button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
