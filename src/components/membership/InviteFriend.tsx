"use client";

import { useState } from "react";
import { Check, Copy, Share2, UserPlus } from "lucide-react";
import { inviteMessage, inviteUrl, inviteWhatsAppUrl } from "@/lib/membership/invite";

/**
 * "Indique um amigo": o sócio compartilha o link da adesão (sem desconto nem rastreio).
 * No celular usa o compartilhamento nativo; no resto, WhatsApp e copiar link. O link é
 * montado no clique, com a origem do próprio site (cada clube tem o seu domínio).
 */
export function InviteFriend({
  programName,
  clubName,
  compact = false,
}: {
  programName?: string | null;
  clubName?: string | null;
  /** Versão enxuta (tela de sucesso da adesão): sem moldura de card. */
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const message = inviteMessage(programName, clubName);
  const link = () => inviteUrl(window.location.origin);

  async function share() {
    const url = link();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: message, url });
        return;
      } catch (err) {
        // Cancelou o compartilhamento: não faz nada. Outro erro: cai no WhatsApp.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    window.open(inviteWhatsAppUrl(message, url), "_blank", "noopener,noreferrer");
  }

  function whatsapp() {
    window.open(inviteWhatsAppUrl(message, link()), "_blank", "noopener,noreferrer");
  }

  async function copy() {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(`${message} ${link()}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  }

  const btn =
    "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90";

  return (
    <section
      aria-labelledby="indique-um-amigo"
      className={compact ? "w-full max-w-xs flex flex-col gap-3" : "bg-card border border-border rounded-xl p-5 flex flex-col gap-3"}
    >
      <div className={compact ? "text-center" : undefined}>
        <p
          id="indique-um-amigo"
          className={`text-xs text-muted-foreground uppercase tracking-wider ${compact ? "" : "flex items-center gap-1.5"}`}
        >
          {!compact && <UserPlus size={14} aria-hidden="true" />}
          Indique um amigo
        </p>
        <p className="text-sm text-foreground mt-1">
          Chame quem também torce para fazer parte com você.
        </p>
      </div>
      <div className={`flex flex-wrap gap-2 ${compact ? "justify-center" : ""}`}>
        <button type="button" onClick={share} className={`${btn} bg-primary text-primary-foreground sm:hidden`}>
          <Share2 size={14} aria-hidden="true" /> Compartilhar
        </button>
        <button type="button" onClick={whatsapp} className={`${btn} bg-[#25D366] text-white hidden sm:inline-flex`}>
          <Share2 size={14} aria-hidden="true" /> Enviar no WhatsApp
        </button>
        <button type="button" onClick={copy} className={`${btn} border border-border text-foreground hover:bg-secondary`}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? "Link copiado!" : "Copiar link"}
        </button>
      </div>
      {copyError && (
        <p role="alert" className="text-xs text-destructive">
          Não foi possível copiar. Use o botão de compartilhar.
        </p>
      )}
    </section>
  );
}
