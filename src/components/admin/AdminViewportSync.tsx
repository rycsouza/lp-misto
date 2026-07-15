"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Informa ao servidor o viewport (mobile/desktop) via cookie, para as listagens
 * paginarem com 5 itens no mobile e 10 no desktop. Como o SSR não conhece a
 * largura da tela, o cookie é setado aqui no client; se ele mudar (ex.: primeiro
 * acesso no celular, ou rotação/resize), damos um refresh para o servidor
 * re-renderizar com o tamanho certo. Desktop é o padrão, então quem usa desktop
 * (a maioria no painel) nunca sofre refresh.
 */
export function AdminViewportSync() {
  const router = useRouter();

  useEffect(() => {
    function sync() {
      const want = window.matchMedia("(max-width: 767px)").matches ? "m" : "d";
      const current = document.cookie.match(/(?:^|; )adm_vp=([^;]*)/)?.[1];
      if (current === want) return;
      document.cookie = `adm_vp=${want}; path=/; max-age=31536000; samesite=lax`;
      // Sem cookie, o servidor assume desktop (10). Só re-renderiza quando o
      // tamanho servido de fato muda: ao querer mobile (precisa virar 5) ou ao
      // voltar de mobile para desktop. No 1º acesso em desktop, nada de refresh.
      if (want === "m" || current === "m") router.refresh();
    }
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [router]);

  return null;
}
