"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestWithdrawal } from "@/app/actions/affiliate-portal";

interface Props {
  affiliateId: string;
  affiliateCode: string;
  eligibleCents: number;
}

const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Celular" },
  { value: "random", label: "Chave aleatória" },
] as const;

function fmtCents(cents: number) {
  return `R$${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export function WithdrawalForm({ affiliateId, affiliateCode, eligibleCents }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pixKeyType, setPixKeyType] = useState<string>("cpf");
  const [pixKey, setPixKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (eligibleCents <= 0) {
    return (
      <p className="text-xs text-muted-foreground text-center">
        Nenhuma comissão elegível para saque ainda. Comissões ficam disponíveis 3 dias após a venda.
      </p>
    );
  }

  if (success) {
    return (
      <p className="text-xs text-green-500 text-center">
        Saque de {fmtCents(eligibleCents)} solicitado com sucesso! Em breve entraremos em contato.
      </p>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pixKey.trim()) {
      setError("Informe sua chave PIX.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await requestWithdrawal(affiliateId, pixKey, pixKeyType);
      if (!result.success) {
        setError(result.error ?? "Erro ao solicitar saque.");
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <div>
      <p className="text-xs font-medium text-foreground mb-3">
        Solicitar saque de <span className="text-green-500 font-bold">{fmtCents(eligibleCents)}</span>
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && (
          <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <select
            value={pixKeyType}
            onChange={(e) => setPixKeyType(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 shrink-0"
          >
            {PIX_KEY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            placeholder="Sua chave PIX"
            className="flex-1 border border-border rounded-lg px-3 py-2 bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? "Solicitando…" : "Solicitar saque"}
        </button>
      </form>
    </div>
  );
}
