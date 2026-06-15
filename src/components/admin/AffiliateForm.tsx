"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AffiliateRow, AffiliateInput } from "@/app/actions/admin-affiliates";
import { createAffiliate, updateAffiliate, suggestAffiliateCode } from "@/app/actions/admin-affiliates";

interface Props {
  affiliate?: AffiliateRow;
}

export function AffiliateForm({ affiliate }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(affiliate?.name ?? "");
  const [email, setEmail] = useState(affiliate?.email ?? "");
  const [whatsapp, setWhatsapp] = useState(affiliate?.whatsapp ?? "");
  const [code, setCode] = useState(affiliate?.code ?? "");
  const [commissionType, setCommissionType] = useState<"pct" | "fixed">(affiliate?.commissionType ?? "pct");
  const [commissionValue, setCommissionValue] = useState(
    commissionType === "fixed" ? (affiliate?.commissionValue ?? 0) / 100 : (affiliate?.commissionValue ?? 10)
  );
  const [active, setActive] = useState(affiliate?.active ?? true);

  async function handleSuggestCode() {
    if (!name) return;
    const suggested = await suggestAffiliateCode(name);
    setCode(suggested);
  }

  function buildInput(): AffiliateInput {
    return {
      name,
      email,
      whatsapp: whatsapp || null,
      code,
      commissionType,
      commissionValue: commissionType === "fixed" ? Math.round(commissionValue * 100) : Math.round(commissionValue),
      active,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const input = buildInput();
      const result = affiliate
        ? await updateAffiliate(affiliate.id, input)
        : await createAffiliate(input);

      if (!result.success) {
        setError((result as { error?: string }).error ?? "Erro desconhecido.");
        return;
      }
      router.push("/admin/afiliados");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-xl">
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Nome *</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => !code && handleSuggestCode()}
          className="border border-border rounded-lg px-3 py-2 bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="João Silva"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">E-mail *</label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="joao@exemplo.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">WhatsApp</label>
        <input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="(11) 99999-9999"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Código de indicação *</label>
        <div className="flex gap-2">
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={20}
            className="flex-1 border border-border rounded-lg px-3 py-2 bg-card text-foreground text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="JOAO123"
          />
          <button
            type="button"
            onClick={handleSuggestCode}
            className="px-3 py-2 text-xs border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Sugerir
          </button>
        </div>
        <p className="text-xs text-muted-foreground">4–20 caracteres alfanuméricos. Gerado automaticamente a partir do nome.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Tipo de comissão *</label>
        <select
          value={commissionType}
          onChange={(e) => setCommissionType(e.target.value as "pct" | "fixed")}
          className="border border-border rounded-lg px-3 py-2 bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="pct">Percentual (%)</option>
          <option value="fixed">Valor fixo (R$)</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          Valor da comissão * {commissionType === "pct" ? "(%" : "(R$"}
        </label>
        <input
          required
          type="number"
          min={0}
          step={commissionType === "pct" ? 1 : 0.01}
          max={commissionType === "pct" ? 100 : undefined}
          value={commissionValue}
          onChange={(e) => setCommissionValue(parseFloat(e.target.value) || 0)}
          className="border border-border rounded-lg px-3 py-2 bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder={commissionType === "pct" ? "10" : "5.00"}
        />
        <p className="text-xs text-muted-foreground">
          {commissionType === "pct"
            ? "Porcentagem sobre o valor do pedido (ex: 10 = 10%)"
            : "Valor fixo em reais por venda confirmada (ex: 5.00)"}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <input
          id="active"
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="w-4 h-4 rounded border-border accent-primary"
        />
        <label htmlFor="active" className="text-sm text-foreground">Afiliado ativo</label>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? "Salvando…" : affiliate ? "Salvar alterações" : "Criar afiliado"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/afiliados")}
          className="px-5 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
