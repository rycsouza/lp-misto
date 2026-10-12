"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { requestMembershipCancellation } from "@/app/actions/membership";

/** Carteirinha → pede o cancelamento; a confirmação chega no e-mail cadastrado. */
export function CancelMembershipButton({ cardToken }: { cardToken: string }) {
  const [step, setStep] = useState<"idle" | "confirm" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (step === "sent") {
    return (
      <p className="text-xs text-muted-foreground text-center">
        Enviamos um e-mail para confirmar o cancelamento. Nada muda até você confirmar.
      </p>
    );
  }

  if (step === "confirm") {
    return (
      <div className="text-center">
        <p className="text-xs text-muted-foreground mb-2">
          Vamos enviar um link de confirmação para o e-mail da sua adesão. Os benefícios continuam até o fim do
          período já pago.
        </p>
        {error && <p className="text-xs text-destructive mb-2">{error}</p>}
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => { setStep("idle"); setError(null); }}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Voltar
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const r = await requestMembershipCancellation(cardToken);
                if (r.ok) setStep("sent");
                else setError(r.error ?? "Não foi possível agora. Tente mais tarde.");
              })
            }
            className="inline-flex items-center gap-1 text-xs text-destructive font-semibold underline disabled:opacity-50"
          >
            {isPending && <Loader2 size={12} className="animate-spin" />}
            Enviar e-mail de cancelamento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={() => setStep("confirm")}
        className="text-xs text-muted-foreground underline hover:text-foreground"
      >
        Cancelar assinatura
      </button>
    </div>
  );
}
