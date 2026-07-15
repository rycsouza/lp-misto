"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AffiliateRow, AffiliateInput } from "@/app/actions/admin-affiliates";
import { createAffiliate, updateAffiliate, suggestAffiliateCode } from "@/app/actions/admin-affiliates";

interface Props {
  affiliate?: AffiliateRow;
}

type FieldErrors = Partial<Record<"name" | "email" | "whatsapp" | "code" | "commissionValue", string>>;

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function validate(
  name: string,
  email: string,
  whatsapp: string,
  code: string,
  commissionType: "pct" | "fixed",
  commissionValue: number
): FieldErrors {
  const errors: FieldErrors = {};
  if (!name.trim() || name.trim().length < 2) errors.name = "Nome deve ter ao menos 2 caracteres.";
  if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "E-mail inválido.";
  if (whatsapp) {
    const digits = whatsapp.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11) errors.whatsapp = "WhatsApp deve ter 10 ou 11 dígitos.";
  }
  if (!code || !/^[A-Z0-9]{4,20}$/.test(code)) errors.code = "Código deve ter 4–20 caracteres alfanuméricos.";
  if (!commissionValue || commissionValue <= 0) errors.commissionValue = "Valor deve ser maior que zero.";
  if (commissionType === "pct" && commissionValue > 100) errors.commissionValue = "Percentual não pode passar de 100%.";
  return errors;
}

const inputClass = "border border-border rounded-md px-3 py-2 bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const inputErrorClass = "border-destructive focus:ring-destructive/40";

export function AffiliateForm({ affiliate }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(affiliate?.name ?? "");
  const [email, setEmail] = useState(affiliate?.email ?? "");
  const [whatsapp, setWhatsapp] = useState(
    affiliate?.whatsapp ? formatPhone(affiliate.whatsapp) : ""
  );
  const [code, setCode] = useState(affiliate?.code ?? "");
  const [commissionType, setCommissionType] = useState<"pct" | "fixed">(affiliate?.commissionType ?? "pct");
  const [commissionValue, setCommissionValue] = useState(
    affiliate?.commissionType === "fixed"
      ? (affiliate?.commissionValue ?? 0) / 100
      : (affiliate?.commissionValue ?? 10)
  );
  const [active, setActive] = useState(affiliate?.active ?? true);

  async function handleSuggestCode() {
    if (!name) return;
    const suggested = await suggestAffiliateCode(name);
    setCode(suggested);
  }

  function buildInput(): AffiliateInput {
    return {
      name: name.trim(),
      email: email.trim(),
      whatsapp: whatsapp ? whatsapp.replace(/\D/g, "") : null,
      code,
      commissionType,
      commissionValue: commissionType === "fixed" ? Math.round(commissionValue * 100) : Math.round(commissionValue),
      active,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors = validate(name, email, whatsapp, code, commissionType, commissionValue);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setServerError(null);
    startTransition(async () => {
      const input = buildInput();
      const result = affiliate
        ? await updateAffiliate(affiliate.id, input)
        : await createAffiliate(input);

      if (!result.success) {
        setServerError((result as { error?: string }).error ?? "Erro desconhecido.");
        return;
      }
      router.push("/admin/afiliados");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-xl">
      {serverError && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-2">
          {serverError}
        </div>
      )}

      {/* Nome */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Nome *</label>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setFieldErrors((p) => ({ ...p, name: undefined })); }}
          onBlur={() => !code && handleSuggestCode()}
          className={`${inputClass} ${fieldErrors.name ? inputErrorClass : ""}`}
          placeholder="João Silva"
        />
        {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
      </div>

      {/* E-mail */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">E-mail *</label>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
          className={`${inputClass} ${fieldErrors.email ? inputErrorClass : ""}`}
          placeholder="joao@exemplo.com"
        />
        {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
      </div>

      {/* WhatsApp */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">WhatsApp</label>
        <input
          type="tel"
          value={whatsapp}
          onChange={(e) => {
            setWhatsapp(formatPhone(e.target.value));
            setFieldErrors((p) => ({ ...p, whatsapp: undefined }));
          }}
          className={`${inputClass} ${fieldErrors.whatsapp ? inputErrorClass : ""}`}
          placeholder="(67) 99999-9999"
        />
        {fieldErrors.whatsapp
          ? <p className="text-xs text-destructive">{fieldErrors.whatsapp}</p>
          : <p className="text-xs text-muted-foreground">Opcional.</p>
        }
      </div>

      {/* Código */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Código de indicação *</label>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
              setFieldErrors((p) => ({ ...p, code: undefined }));
            }}
            maxLength={20}
            className={`flex-1 font-mono uppercase ${inputClass} ${fieldErrors.code ? inputErrorClass : ""}`}
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
        {fieldErrors.code
          ? <p className="text-xs text-destructive">{fieldErrors.code}</p>
          : <p className="text-xs text-muted-foreground">4–20 caracteres alfanuméricos. Gerado automaticamente a partir do nome.</p>
        }
      </div>

      {/* Tipo de comissão */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Tipo de comissão *</label>
        <select
          value={commissionType}
          onChange={(e) => {
            const t = e.target.value as "pct" | "fixed";
            setCommissionType(t);
            setCommissionValue(t === "pct" ? 10 : 5);
          }}
          className={`form-select ${inputClass.replace("px-3", "pl-3 pr-9")}`}
        >
          <option value="pct">Percentual (%)</option>
          <option value="fixed">Valor fixo (R$)</option>
        </select>
      </div>

      {/* Valor da comissão */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          Valor da comissão * {commissionType === "pct" ? "(%)" : "(R$)"}
        </label>
        <input
          type="number"
          min={commissionType === "pct" ? 1 : 0.01}
          step={commissionType === "pct" ? 1 : 0.01}
          max={commissionType === "pct" ? 100 : undefined}
          value={commissionValue}
          onChange={(e) => {
            setCommissionValue(parseFloat(e.target.value) || 0);
            setFieldErrors((p) => ({ ...p, commissionValue: undefined }));
          }}
          className={`${inputClass} ${fieldErrors.commissionValue ? inputErrorClass : ""}`}
          placeholder={commissionType === "pct" ? "10" : "5.00"}
        />
        {fieldErrors.commissionValue
          ? <p className="text-xs text-destructive">{fieldErrors.commissionValue}</p>
          : <p className="text-xs text-muted-foreground">
              {commissionType === "pct"
                ? "Porcentagem sobre o valor do pedido (ex: 10 = 10%)"
                : "Valor fixo em reais por venda confirmada (ex: 5.00)"}
            </p>
        }
      </div>

      {/* Ativo */}
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
