"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { reconcileRecentPayments } from "@/app/actions/admin";

/**
 * Dispara a reconciliação de pagamentos com o gateway ao carregar o dashboard.
 * O throttle (intervalo mínimo e janela de horas) é decidido no servidor via
 * `siteConfig`, então é seguro chamar a cada montagem — quando não está na hora,
 * a server action retorna imediatamente sem tocar no gateway.
 */
export function PaymentReconciler() {
  const router = useRouter();

  useEffect(() => {
    reconcileRecentPayments()
      .then(({ corrected }) => {
        if (corrected > 0) router.refresh();
      })
      .catch(() => {
        // Reconciliação é best-effort; silencia falhas para não quebrar o dashboard.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
