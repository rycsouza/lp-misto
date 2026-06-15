"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { markWithdrawalPaid, rejectWithdrawal } from "@/app/actions/admin-affiliates";
import { CheckCircle2, XCircle } from "lucide-react";

interface Props {
  withdrawalId: string;
}

export function WithdrawalActions({ withdrawalId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmPaid, setConfirmPaid] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  function handleMarkPaid() {
    setConfirmPaid(false);
    startTransition(async () => {
      await markWithdrawalPaid(withdrawalId);
      router.refresh();
    });
  }

  function handleReject() {
    if (!reason.trim()) return;
    setRejectOpen(false);
    startTransition(async () => {
      await rejectWithdrawal(withdrawalId, reason.trim());
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center gap-1 justify-end">
        <button
          type="button"
          onClick={() => setConfirmPaid(true)}
          disabled={isPending}
          className="flex items-center gap-1 text-xs text-green-600 hover:bg-green-500/10 px-2 py-1 rounded transition-colors disabled:opacity-50"
        >
          <CheckCircle2 size={13} /> Pago
        </button>
        <button
          type="button"
          onClick={() => setRejectOpen(true)}
          disabled={isPending}
          className="flex items-center gap-1 text-xs text-destructive hover:bg-destructive/10 px-2 py-1 rounded transition-colors disabled:opacity-50"
        >
          <XCircle size={13} /> Rejeitar
        </button>
      </div>

      <ConfirmModal
        open={confirmPaid}
        title="Marcar saque como pago?"
        description="Esta ação marcará o saque e as comissões pendentes do afiliado como pagas."
        confirmLabel="Confirmar pagamento"
        isPending={isPending}
        onConfirm={handleMarkPaid}
        onCancel={() => setConfirmPaid(false)}
      />

      {rejectOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setRejectOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-foreground font-semibold text-sm mb-3">Rejeitar saque</h3>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo da rejeição…"
              rows={3}
              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRejectOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={!reason.trim() || isPending}
                className="px-4 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
              >
                {isPending ? "Rejeitando…" : "Rejeitar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
