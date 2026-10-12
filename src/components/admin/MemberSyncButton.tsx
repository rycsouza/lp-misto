"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { syncMemberPaymentAdmin } from "@/app/actions/membership";

const MESSAGES: Record<string, string> = {
  active: "Pagamento confirmado — sócio ativado.",
  pending: "Ainda sem pagamento confirmado no gateway.",
  not_found: "Assinatura não encontrada no gateway.",
  unsupported: "O gateway ativo não permite verificar automaticamente.",
  cancelled: "Sócio cancelado.",
};

/** Reconsulta o gateway para um sócio pendente (ativa só se houver cobrança paga). */
export function MemberSyncButton({ memberId }: { memberId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await syncMemberPaymentAdmin(memberId);
            setMessage(r.success ? MESSAGES[r.status ?? ""] ?? null : r.error ?? "Erro ao verificar.");
          })
        }
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
      >
        <RefreshCw size={12} className={isPending ? "animate-spin" : ""} />
        Verificar pagamento
      </button>
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
    </span>
  );
}
