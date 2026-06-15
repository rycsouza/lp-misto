"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelOrder } from "@/app/actions/admin";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { XCircle } from "lucide-react";

interface OrderActionsProps {
  orderId: string;
  currentStatus: string;
}

const FINAL_STATUSES = new Set(["cancelled", "refunded"]);

export function OrderActions({ orderId, currentStatus }: OrderActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (FINAL_STATUSES.has(currentStatus)) return null;

  const isPaid = currentStatus === "paid";

  function handleConfirm() {
    setConfirmOpen(false);
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
    <>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={isPending}
          className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-2 text-sm font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50 w-fit"
        >
          <XCircle size={15} />
          {isPending ? "Cancelando..." : isPaid ? "Cancelar e Reembolsar" : "Cancelar Pedido"}
        </button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <ConfirmModal
        open={confirmOpen}
        title={isPaid ? "Cancelar e reembolsar pedido?" : "Cancelar pedido pendente?"}
        description={
          isPaid
            ? "Este pedido foi pago. O cliente será reembolsado via gateway de pagamento. Esta ação não pode ser desfeita."
            : "O pedido será cancelado e o cliente não poderá mais realizar o pagamento."
        }
        confirmLabel={isPaid ? "Cancelar e Reembolsar" : "Cancelar Pedido"}
        isPending={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
