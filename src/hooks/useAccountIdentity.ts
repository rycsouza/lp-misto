"use client";

import { useEffect, useState } from "react";
import { getCheckoutIdentity } from "@/app/actions/account";

export type AccountIdentity = NonNullable<Awaited<ReturnType<typeof getCheckoutIdentity>>>;

// Componentes montados juntos dividem a mesma consulta (só enquanto está em voo:
// depois de entrar/sair da conta, a próxima tela consulta de novo).
let pending: Promise<AccountIdentity | null> | null = null;

/**
 * Cliente logado na área do cliente → seus dados para identificar o checkout
 * automaticamente (`undefined` enquanto carrega; `null` sem sessão).
 */
export function useAccountIdentity(): AccountIdentity | null | undefined {
  const [identity, setIdentity] = useState<AccountIdentity | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    pending ??= getCheckoutIdentity()
      .catch(() => null)
      .finally(() => {
        pending = null;
      });
    pending.then((v) => {
      if (alive) setIdentity(v);
    });
    return () => {
      alive = false;
    };
  }, []);
  return identity;
}

/** "67999998888" → "(67) 99999-8888" */
export function formatIdentityPhone(digits: string): string {
  return digits.length === 11 ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}` : digits;
}
