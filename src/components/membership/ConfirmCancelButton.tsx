"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { confirmMembershipCancellation } from "@/app/actions/membership";

/** Página do link do e-mail: só cancela ao clicar (nunca ao abrir o link). */
export function ConfirmCancelButton({ token }: { token: string }) {
  const [done, setDone] = useState<{ until: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="text-center">
        <CheckCircle2 size={36} className="mx-auto text-primary mb-3" />
        <p className="text-foreground font-semibold mb-1">Assinatura cancelada</p>
        <p className="text-sm text-muted-foreground">
          {done.until
            ? `Você não será mais cobrado. Seus benefícios continuam até ${new Date(done.until).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`
            : "Você não será mais cobrado."}
        </p>
        <Link href="/" className="inline-block mt-4 text-xs text-muted-foreground underline hover:text-foreground">
          Voltar ao site
        </Link>
      </div>
    );
  }

  return (
    <div>
      {error && <p className="text-sm text-destructive mb-3">{error}</p>}
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await confirmMembershipCancellation(token);
            if (r.ok) setDone({ until: r.benefitsUntil ?? null });
            else setError(r.error ?? "Não foi possível cancelar agora.");
          })
        }
        className="flex items-center justify-center gap-2 w-full py-3 bg-destructive text-white font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {isPending && <Loader2 size={16} className="animate-spin" />}
        Confirmar cancelamento
      </button>
      <Link href="/" className="block text-center mt-3 text-xs text-muted-foreground underline hover:text-foreground">
        Não quero cancelar
      </Link>
    </div>
  );
}
