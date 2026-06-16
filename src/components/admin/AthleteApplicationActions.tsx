"use client";

import { useState, useTransition } from "react";
import { approveAthleteApplication, rejectAthleteApplication } from "@/app/actions/athletes";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface Props {
  applicationId: string;
  status: "pending" | "approved" | "rejected";
}

export function AthleteApplicationActions({ applicationId, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (status !== "pending") {
    return (
      <span className={`text-xs font-medium ${status === "approved" ? "text-green-500" : "text-destructive"}`}>
        {status === "approved" ? "Aprovado" : "Rejeitado"}
      </span>
    );
  }

  function handleApprove() {
    startTransition(async () => {
      const res = await approveAthleteApplication(applicationId);
      if (!res.success) setError(res.error ?? "Erro");
    });
  }

  function handleReject() {
    if (!showReject) { setShowReject(true); return; }
    startTransition(async () => {
      const res = await rejectAthleteApplication(applicationId, reason || undefined);
      if (!res.success) setError(res.error ?? "Erro");
      else setShowReject(false);
    });
  }

  if (isPending) {
    return <Loader2 size={16} className="animate-spin text-muted-foreground" />;
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      {error && <p className="text-xs text-destructive">{error}</p>}
      {showReject && (
        <input
          className="bg-input border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring w-44"
          placeholder="Motivo (opcional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
      )}
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          className="flex items-center gap-1 text-xs text-green-500 hover:text-green-400 transition-colors"
        >
          <CheckCircle2 size={14} />
          Aprovar
        </button>
        <button
          onClick={handleReject}
          className="flex items-center gap-1 text-xs text-destructive hover:opacity-80 transition-opacity"
        >
          <XCircle size={14} />
          {showReject ? "Confirmar" : "Rejeitar"}
        </button>
      </div>
    </div>
  );
}
