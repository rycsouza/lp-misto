"use client";

import { useCallback, useState } from "react";
import { ConfirmModal } from "@/components/admin/ConfirmModal";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  /** Ação executada ao confirmar. Pode ser assíncrona — o modal fica "Aguarde...". */
  onConfirm: () => void | Promise<void>;
}

/**
 * Substitui `window.confirm` por um modal estilizado (ConfirmModal). Nunca use
 * `alert`/`confirm`/`prompt` nativos no painel — use este hook.
 *
 * Uso:
 *   const { confirm, dialog } = useConfirm();
 *   ...
 *   <button onClick={() => confirm({ title: "Arquivar?", onConfirm: () => act(...) })}>
 *   ...
 *   {dialog}
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const [pending, setPending] = useState(false);

  const confirm = useCallback((opts: ConfirmOptions) => setState(opts), []);

  async function handleConfirm() {
    if (!state) return;
    try {
      setPending(true);
      await state.onConfirm();
    } finally {
      setPending(false);
      setState(null);
    }
  }

  const dialog = (
    <ConfirmModal
      open={!!state}
      title={state?.title ?? ""}
      description={state?.description}
      confirmLabel={state?.confirmLabel}
      isPending={pending}
      onConfirm={handleConfirm}
      onCancel={() => {
        if (!pending) setState(null);
      }}
    />
  );

  return { confirm, dialog };
}
