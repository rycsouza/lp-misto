"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { importMembershipPaymentsHistory } from "@/app/actions/admin-membership-reports";

/** Limite de lotes por clique (cada lote = 100 sócios). Evita laço sem fim. */
const MAX_BATCHES = 50;

/**
 * Importa o histórico de mensalidades do gateway para o ledger. Roda em lotes pelo
 * cursor (id do último sócio) até acabar. Idempotente: pode ser clicado de novo.
 */
export function MembershipHistoryImportButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  async function handleImport() {
    setRunning(true);
    setProgress("Importando histórico...");
    let processed = 0;
    let failed = 0;
    let cursor: string | null = null;
    try {
      for (let i = 0; i < MAX_BATCHES; i++) {
        const batch = await importMembershipPaymentsHistory({ afterMemberId: cursor });
        if (!batch.supported) {
          setProgress("O gateway ativo não oferece histórico de mensalidades.");
          return;
        }
        processed += batch.processed;
        failed += batch.failed;
        setProgress(`${processed} sócio(s) processado(s)...`);
        if (!batch.nextCursor) {
          setProgress(
            `Concluído: ${processed} sócio(s)${failed ? `, ${failed} com falha (tente de novo)` : ""}.`
          );
          router.refresh();
          return;
        }
        cursor = batch.nextCursor;
      }
      setProgress(`Parcial: ${processed} sócio(s). Clique de novo para continuar.`);
      router.refresh();
    } catch (err) {
      setProgress(err instanceof Error ? err.message : "Falha ao importar o histórico.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleImport}
        disabled={running}
        className="flex items-center gap-1.5 bg-secondary border border-border text-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors"
      >
        <RefreshCw size={16} className={running ? "animate-spin" : undefined} />
        Importar histórico de mensalidades
      </button>
      {progress && <p className="text-xs text-muted-foreground">{progress}</p>}
    </div>
  );
}
