"use client";

import { useEffect, useState } from "react";
import { Smartphone, Download, X, Share } from "lucide-react";

const DISMISS_KEY = "pwa_install_dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

/**
 * Banner discreto de "instalar / adicionar à tela inicial".
 * - Android/Chrome: usa o evento beforeinstallprompt → botão Instalar nativo.
 * - iOS/Safari (sem API de prompt): mostra a instrução Compartilhar → Adicionar.
 * Some se já estiver instalado (standalone) ou após o usuário dispensar.
 * Toda a detecção roda em callbacks (eventos/rAF), nunca no corpo do efeito.
 */
export function InstallAppPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch { /* ignore */ }
    if (dismissed) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    const onInstalled = () => {
      setHidden(true);
      try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    const raf = requestAnimationFrame(() => {
      const nav = navigator as Navigator & { standalone?: boolean };
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
      if (standalone) return;
      const ua = navigator.userAgent;
      const isIOS = /iphone|ipad|ipod/i.test(ua);
      const isSafari = /safari/i.test(ua) && !/crios|fxios|android|chrome/i.test(ua);
      if (isIOS && isSafari) {
        setIosHint(true);
        setHidden(false);
      }
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      cancelAnimationFrame(raf);
    };
  }, []);

  function dismiss() {
    setHidden(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => {});
    setDeferred(null);
    dismiss();
  }

  if (hidden || (!deferred && !iosHint)) return null;

  return (
    <div className="fixed bottom-24 lg:bottom-4 inset-x-4 z-50 mx-auto max-w-md bg-card border border-border rounded-xl shadow-2xl p-4 flex items-center gap-3">
      <span className="shrink-0 w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
        <Smartphone size={20} className="text-primary" />
      </span>
      <div className="flex-1 min-w-0">
        {deferred ? (
          <>
            <p className="text-sm font-semibold text-foreground">Instale o app do clube</p>
            <p className="text-xs text-muted-foreground">
              Acesso rápido aos ingressos, direto na tela inicial.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-foreground">Adicione à tela inicial</p>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1 flex-wrap">
              Toque em <Share size={12} className="inline shrink-0" /> e em “Adicionar à Tela de Início”.
            </p>
          </>
        )}
      </div>
      {deferred && (
        <button
          onClick={install}
          className="shrink-0 flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Download size={15} /> Instalar
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Dispensar"
        className="shrink-0 text-muted-foreground hover:text-foreground p-1"
      >
        <X size={18} />
      </button>
    </div>
  );
}
