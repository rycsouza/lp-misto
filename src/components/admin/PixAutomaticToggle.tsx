"use client";

import { useState, useTransition } from "react";
import { updateConfigValues } from "@/app/actions/admin";
import { PIX_AUTOMATIC_ENABLED_KEY } from "@/lib/membership/pix-automatic-config";

/**
 * Liga/desliga o Pix Automático na adesão de sócio (aba Gateways, só admin do sistema). O
 * servidor aceita só "true"/"false" e só do admin do sistema (chave de plataforma).
 */
export function PixAutomaticToggle({ enabled, asaasActive }: { enabled: boolean; asaasActive: boolean }) {
  const [on, setOn] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setError(null);
    startTransition(async () => {
      try {
        await updateConfigValues({ [PIX_AUTOMATIC_ENABLED_KEY]: next ? "true" : "false" });
        setOn(next);
      } catch {
        setError("Não foi possível salvar agora.");
      }
    });
  }

  return (
    <section className="bg-card border border-border rounded-xl p-6 flex flex-col gap-3">
      <div>
        <h3 className="font-semibold text-foreground">Pix Automático (sócio-torcedor)</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Oferece o Pix Automático na adesão, além do cartão: o sócio paga a 1ª mensalidade por QR Code e autoriza as
          próximas no app do banco. Só funciona com o gateway Asaas e precisa estar liberado na conta Asaas do clube
          (pedido em integracoes@asaas.com.br).
        </p>
      </div>
      {!asaasActive && (
        <p className="text-xs text-muted-foreground">O gateway ativo não é Asaas: a opção não aparece na adesão.</p>
      )}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={on}
          disabled={isPending}
          onChange={toggle}
        />
        <span className="text-sm text-foreground">Oferecer Pix Automático na adesão</span>
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
