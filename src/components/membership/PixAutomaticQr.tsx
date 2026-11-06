"use client";

import { useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";

/** Só imagem PNG em base64 (o servidor já validou; aqui é defesa em profundidade). */
function qrImageSrc(base64: string | null): string | null {
  return base64 && /^[A-Za-z0-9+/]+={0,2}$/.test(base64) ? `data:image/png;base64,${base64}` : null;
}

function formatExpiry(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

/**
 * QR Code da 1ª mensalidade do Pix Automático. O mesmo pagamento autoriza as próximas no app
 * do banco. A tela acompanha a confirmação sozinha (o status vem do servidor).
 */
export function PixAutomaticQr({
  payload,
  imageBase64,
  expiresAt,
  amountLabel,
  nextChargeLabel,
  waitingTooLong,
}: {
  payload: string;
  imageBase64: string | null;
  expiresAt: string | null;
  /** Valor da mensalidade formatado (ex.: "R$ 29,90"). */
  amountLabel: string;
  /** Data da próxima cobrança automática (ex.: "06/12"). */
  nextChargeLabel: string;
  /** Acompanhamento parou: a confirmação chega depois na conta. */
  waitingTooLong: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const src = qrImageSrc(imageBase64);
  const expiry = formatExpiry(expiresAt);

  async function copy() {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="QR Code do Pix Automático" width={220} height={220} className="rounded-xl bg-white p-2" />
      )}
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        {copied ? "Código copiado!" : "Copiar código Pix (copia e cola)"}
      </button>
      {copyError && (
        <p role="alert" className="text-xs text-destructive">
          Não foi possível copiar. Use o QR Code.
        </p>
      )}
      {expiry && <p className="text-xs text-muted-foreground">Válido até {expiry}.</p>}

      <ol className="text-left text-sm text-muted-foreground list-decimal pl-5 flex flex-col gap-1.5">
        <li>
          Abra o app do seu banco e pague <strong className="text-foreground">{amountLabel}</strong> pelo QR Code ou
          pelo código copia e cola.
        </li>
        <li>
          No mesmo pagamento, <strong className="text-foreground">autorize o Pix Automático</strong>: as próximas
          mensalidades de {amountLabel} são debitadas todo mês, a partir de {nextChargeLabel}.
        </li>
        <li>Pronto: assim que o banco confirmar, sua carteirinha é liberada.</li>
      </ol>
      <p className="text-xs text-muted-foreground">
        Você pode cancelar quando quiser, pelo app do banco ou na sua conta.
      </p>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        {waitingTooLong ? (
          "A confirmação está demorando. Assim que o banco confirmar, a carteirinha aparece na sua conta."
        ) : (
          <>
            <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Aguardando o pagamento e a autorização…
          </>
        )}
      </p>
    </div>
  );
}
