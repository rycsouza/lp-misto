"use client";

import { useEffect } from "react";

/**
 * Reload/refresh: os navegadores restauram a rolagem anterior (scrollRestoration
 * "auto"), então uma tela recarregada reaparece rolada para baixo — experiência
 * ruim. Aqui forçamos o topo APENAS quando a navegação é um reload. Back/forward
 * continua restaurando a posição (isso é bom UX, e não foi o que incomodou).
 *
 * A navegação entre rotas no App Router já rola para o topo por padrão — este
 * componente cobre só a lacuna do reload.
 */
export function ScrollManager() {
  useEffect(() => {
    try {
      const [nav] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
      if (nav?.type !== "reload") return;
      // Sobe agora e de novo no próximo frame — cobre páginas que crescem depois
      // de hidratar (e que o browser tentaria re-rolar para a posição salva).
      window.scrollTo(0, 0);
      requestAnimationFrame(() => window.scrollTo(0, 0));
    } catch {
      /* Performance API indisponível — ignora silenciosamente. */
    }
  }, []);

  return null;
}
