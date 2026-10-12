"use client";

// Formulário de cartão do Asaas (sem SDK no browser): os dados vão direto na
// criação da assinatura, no servidor. Usado na adesão e na troca de plano.
import { useState } from "react";
import { Loader2 } from "lucide-react";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── ASAAS CARD FORM ───────────────────────────────────────────────────────────
// Asaas não tem SDK no browser: os campos ficam no nosso formulário e o cartão
// vai direto na criação da assinatura (servidor). Visual igual ao da loja.

export interface AsaasCardFormProps {
  amountCents: number;
  onSubmit: (data: {
    holderName: string; number: string; expiryMonth: string;
    expiryYear: string; ccv: string; postalCode: string; addressNumber: string;
  }) => void;
  onBack: () => void;
  isPending: boolean;
  error: string | null;
  errorAction?: React.ReactNode;
  /** Texto do botão (padrão "Assinar"). */
  submitLabel?: string;
  /** Linha abaixo do valor (ex.: "1ª cobrança em 12/11"). */
  note?: string;
}

function formatCardNumber(raw: string) {
  return raw.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

function formatCEP(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function AsaasCardForm({
  amountCents,
  onSubmit,
  onBack,
  isPending,
  error,
  errorAction,
  submitLabel = "Assinar",
  note,
}: AsaasCardFormProps) {
  const [number, setNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [ccv, setCcv] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const inputCls =
    "w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60";

  function validate() {
    const e: Record<string, string> = {};
    if (number.replace(/\D/g, "").length < 13) e.number = "Número inválido";
    if (holderName.trim().length < 3) e.holderName = "Obrigatório";
    const mm = Number(expiry.slice(0, 2));
    if (expiry.replace(/\D/g, "").length !== 4 || mm < 1 || mm > 12) e.expiry = "Formato inválido (MM/AA)";
    if (ccv.length < 3) e.ccv = "CVV inválido";
    if (postalCode.replace(/\D/g, "").length !== 8) e.postalCode = "CEP inválido";
    if (!addressNumber.trim()) e.addressNumber = "Obrigatório";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending || !validate()) return;
    const digits = expiry.replace(/\D/g, "");
    onSubmit({
      holderName: holderName.trim(),
      number: number.replace(/\D/g, ""),
      expiryMonth: digits.slice(0, 2),
      expiryYear: `20${digits.slice(2)}`,
      ccv,
      postalCode: postalCode.replace(/\D/g, ""),
      addressNumber: addressNumber.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-2">
        Dados do Cartão
      </h2>
      <p className={`text-3xl font-bold text-primary ${note ? "mb-1" : "mb-6"}`}>
        {formatBRL(amountCents)}
        <span className="text-muted-foreground font-normal text-base">/mês</span>
      </p>
      {note && <p className="text-xs text-muted-foreground mb-6">{note}</p>}

      {/* fieldset desabilitado durante o envio: mantém os dados se der erro */}
      <fieldset disabled={isPending} className="space-y-4">
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Número do cartão *</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0000 0000 0000 0000"
            value={number}
            onChange={(e) => setNumber(formatCardNumber(e.target.value))}
            autoComplete="cc-number"
            className={inputCls}
          />
          {errors.number && <p className="text-destructive text-xs mt-1">{errors.number}</p>}
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-1">Nome no cartão *</label>
          <input
            type="text"
            placeholder="Como aparece no cartão"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            autoComplete="cc-name"
            className={inputCls}
          />
          {errors.holderName && <p className="text-destructive text-xs mt-1">{errors.holderName}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Validade *</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="MM/AA"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              autoComplete="cc-exp"
              className={inputCls}
            />
            {errors.expiry && <p className="text-destructive text-xs mt-1">{errors.expiry}</p>}
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">CVV *</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="123"
              value={ccv}
              onChange={(e) => setCcv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              autoComplete="cc-csc"
              className={inputCls}
            />
            {errors.ccv && <p className="text-destructive text-xs mt-1">{errors.ccv}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">CEP *</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="00000-000"
              value={postalCode}
              onChange={(e) => setPostalCode(formatCEP(e.target.value))}
              autoComplete="billing postal-code"
              className={inputCls}
            />
            {errors.postalCode && <p className="text-destructive text-xs mt-1">{errors.postalCode}</p>}
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Número *</label>
            <input
              type="text"
              placeholder="Ex: 123"
              value={addressNumber}
              onChange={(e) => setAddressNumber(e.target.value)}
              className={inputCls}
            />
            {errors.addressNumber && <p className="text-destructive text-xs mt-1">{errors.addressNumber}</p>}
          </div>
        </div>

        {error && (
          <p className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
            {error} {errorAction}
          </p>
        )}
      </fieldset>

      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onBack}
          disabled={isPending}
          className="flex-1 py-3 bg-secondary text-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-secondary/80 transition-colors disabled:opacity-40"
        >
          Voltar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Processando...
            </span>
          ) : (
            submitLabel
          )}
        </button>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Dados criptografados - não armazenamos dados do cartão
      </p>
    </form>
  );
}

