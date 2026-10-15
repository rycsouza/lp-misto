"use client";

import { useEffect, useState } from "react";
import { getMyMemberPricing } from "@/app/actions/account";

export type MemberPricing = NonNullable<Awaited<ReturnType<typeof getMyMemberPricing>>>;

// Componentes montados juntos dividem a mesma consulta (só enquanto está em voo).
let pending: Promise<MemberPricing | null> | null = null;

/**
 * Desconto de sócio do cliente LOGADO, para mostrar preço e total antes de pagar.
 * `undefined` enquanto carrega; `null` sem sessão ou sem benefício. Só existe no
 * client: as páginas podem ser cacheadas e compartilhadas entre visitantes.
 */
export function useMemberPricing(): MemberPricing | null | undefined {
  const [pricing, setPricing] = useState<MemberPricing | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    pending ??= getMyMemberPricing()
      .catch(() => null)
      .finally(() => {
        pending = null;
      });
    pending.then((v) => {
      if (alive) setPricing(v);
    });
    return () => {
      alive = false;
    };
  }, []);
  return pricing;
}
