"use client";

import { useEffect } from "react";

/**
 * Registra o service worker (/sw.js) do site. Fica só no layout do site, nunca no admin.
 * Só em produção: em dev o SW atrapalharia o hot reload. Erros são ignorados em silêncio.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // sem SW, o site segue normal (só perde o modo offline)
    });
  }, []);

  return null;
}
