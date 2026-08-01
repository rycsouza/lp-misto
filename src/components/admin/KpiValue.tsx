"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Mostra o valor CHEIO (ex.: "R$ 3.548,90") e só troca pela forma compacta
 * ("R$ 3,5K") quando ele realmente NÃO cabe no card — medido no cliente com um
 * span invisível de referência + ResizeObserver. Assim não compactamos à toa:
 * em telas onde cabe, o número aparece por extenso. SSR renderiza cheio.
 */
export function KpiValue({
  full,
  compact,
  className = "",
}: {
  full: string;
  compact: string;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [useCompact, setUseCompact] = useState(false);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const measure = measureRef.current;
    if (!wrap || !measure) return;
    // O medidor tem sempre o valor cheio, na MESMA fonte, sem quebrar linha.
    // Se a largura dele passa da largura disponível do card, compactamos.
    const check = () => setUseCompact(measure.scrollWidth > wrap.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [full, compact]);

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden">
      <p className={`${className} whitespace-nowrap`} title={useCompact ? full : undefined}>
        {useCompact ? compact : full}
      </p>
      <span
        ref={measureRef}
        aria-hidden
        className={`${className} invisible absolute left-0 top-0 whitespace-nowrap pointer-events-none`}
      >
        {full}
      </span>
    </div>
  );
}
