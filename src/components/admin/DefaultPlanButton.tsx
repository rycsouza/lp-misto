"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { setDefaultMembershipPlan } from "@/app/actions/admin-growth";

interface DefaultPlanButtonProps {
  planId: string;
  active: boolean;
  /** Este plano já é o padrão do clube. */
  isDefault: boolean;
}

const INACTIVE_HINT = "Ative o plano para defini-lo como padrão.";

/**
 * Define este plano como padrão da adesão (quando o link não traz ?plano), ou remove o
 * padrão se ele já for este plano. Plano inativo não pode ser padrão.
 */
export function DefaultPlanButton({ planId, active, isDefault }: DefaultPlanButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const blockedByInactive = !isDefault && !active;

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={isPending || blockedByInactive}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await setDefaultMembershipPlan(isDefault ? null : planId);
            if (!r.success) setError(r.error ?? "Não foi possível salvar.");
          })
        }
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Star size={12} className={isDefault ? "fill-current" : ""} />
        {isDefault ? "Remover padrão" : "Definir como padrão"}
      </button>
      {blockedByInactive && <span className="text-[11px] text-muted-foreground">{INACTIVE_HINT}</span>}
      {error && (
        <span role="alert" className="text-[11px] text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
