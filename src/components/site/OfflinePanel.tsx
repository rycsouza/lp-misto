"use client";

import { useMemo, useSyncExternalStore } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { MemberCard } from "@/components/membership/MemberCard";
import { parseOfflineRecord, readOfflineCardRaw } from "@/lib/membership/offline-card";
import { TZ } from "@/lib/date";

// O localStorage não existe no servidor: no SSR e na hidratação o valor é null, e o
// cliente lê o valor real logo depois, sem divergência de HTML.
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
const noServerValue = () => null;

const fmtSavedAt = (d: Date) =>
  d
    .toLocaleString("pt-BR", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(", ", " ");

/**
 * Página offline: aviso, botão para tentar de novo e, se houver carteirinha salva neste
 * aparelho, o cartão com a data em que foi salva. Não usa banco nem dados do servidor.
 */
export function OfflinePanel() {
  const raw = useSyncExternalStore(subscribe, readOfflineCardRaw, noServerValue);
  const saved = useMemo(() => parseOfflineRecord(raw, new Date()), [raw]);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <WifiOff size={40} className="text-muted-foreground" aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground">Você está sem conexão</h1>
        <p className="text-sm text-muted-foreground">Verifique sua internet e tente de novo.</p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        <RefreshCw size={16} aria-hidden="true" />
        Tentar de novo
      </button>

      {saved && (
        <div className="flex w-full flex-col gap-3">
          <MemberCard card={saved.card} siteName={saved.siteName} />
          <p className="text-xs text-muted-foreground">
            Carteirinha salva neste aparelho em {fmtSavedAt(saved.savedAt)} — a situação pode ter mudado; a equipe
            confere ao vivo.
          </p>
        </div>
      )}
    </div>
  );
}
