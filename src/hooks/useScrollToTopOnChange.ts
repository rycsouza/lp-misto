"use client";

import { useEffect, useRef } from "react";

/**
 * Rola a janela para o topo sempre que `key` muda — exceto na primeira
 * renderização. Usado nos wizards (checkout, sorteio, adesão, cantina) para que
 * avançar/voltar um passo comece o novo passo lá em cima, e não com a tela ainda
 * rolada de onde o passo anterior estava. Respeita prefers-reduced-motion.
 */
export function useScrollToTopOnChange(key: unknown) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }, [key]);
}
