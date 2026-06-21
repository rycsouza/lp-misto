"use client";

import { useState, useTransition, useEffect } from "react";
import { lookupAddress, getShippingOptions, getCustomerAddresses, saveCustomerAddress } from "@/app/actions/shipping";
import type { ShippingAddress, ShippingOption, CartItemForShipping } from "@/lib/shipping/types";

interface ShippingStepProps {
  cartItems: CartItemForShipping[];
  subtotalCents: number;
  buyerWhatsapp?: string;
  initial?: { address: ShippingAddress; option: ShippingOption } | null;
  onNext: (address: ShippingAddress, option: ShippingOption) => void;
  onBack: () => void;
}

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return digits;
}

function formatPrice(cents: number): string {
  if (cents === 0) return "Grátis";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

const EMPTY: ShippingAddress = {
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
};

export function ShippingStep({
  cartItems, subtotalCents, buyerWhatsapp, initial, onNext, onBack,
}: ShippingStepProps) {
  const [savedAddresses, setSavedAddresses] = useState<ShippingAddress[]>([]);
  const [address, setAddress] = useState<ShippingAddress>(initial?.address ?? EMPTY);
  const [options, setOptions] = useState<ShippingOption[] | null>(initial?.option ? [initial.option] : null);
  const [selected, setSelected] = useState<string | null>(initial?.option?.id ?? null);
  const [saveAddr, setSaveAddr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLooking, startLookup] = useTransition();
  const [isCalc, startCalc] = useTransition();

  const inputClass =
    "bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring w-full";
  const labelClass = "text-sm text-muted-foreground mb-1 block";

  // Busca endereços salvos do cliente
  useEffect(() => {
    if (!buyerWhatsapp) return;
    getCustomerAddresses(buyerWhatsapp).then(setSavedAddresses);
  }, [buyerWhatsapp]);

  function selectSavedAddress(addr: ShippingAddress) {
    setAddress(addr);
    setOptions(null);
    setSelected(null);
    setError(null);
  }

  function handleCepChange(raw: string) {
    const formatted = formatCep(raw);
    setAddress((prev) => ({ ...prev, cep: formatted }));
    setOptions(null);
    setSelected(null);
    setError(null);
    const digits = formatted.replace(/\D/g, "");
    if (digits.length === 8) {
      startLookup(async () => {
        const result = await lookupAddress(digits);
        if (result) {
          setAddress((prev) => ({
            ...prev,
            logradouro: result.logradouro,
            bairro: result.bairro,
            cidade: result.cidade,
            estado: result.estado,
          }));
        } else {
          setError("CEP não encontrado. Verifique e tente novamente.");
        }
      });
    }
  }

  function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startCalc(async () => {
      const opts = await getShippingOptions(address.cep, cartItems, subtotalCents);
      if (opts.length === 0) {
        setError("Não foi possível calcular o frete para este CEP. Verifique se o CEP está correto ou entre em contato.");
      } else {
        setOptions(opts);
        setSelected(opts[0].id);
      }
    });
  }

  async function handleNext() {
    const opt = options?.find((o) => o.id === selected);
    if (!opt) return;
    if (saveAddr && buyerWhatsapp) {
      await saveCustomerAddress(buyerWhatsapp, address);
    }
    onNext(address, opt);
  }

  const cepDigits = address.cep.replace(/\D/g, "");
  const addressReady = cepDigits.length === 8 && !!address.logradouro;

  return (
    <div className="flex flex-col gap-6">
      {/* Endereços salvos */}
      {savedAddresses.length > 0 && !options && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Endereços salvos</p>
          {savedAddresses.map((addr, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectSavedAddress(addr)}
              className={`text-left p-3 rounded-lg border transition-colors text-sm ${
                address.cep === addr.cep && address.numero === addr.numero
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border hover:bg-secondary/50 text-muted-foreground"
              }`}
            >
              <span className="font-medium text-foreground">
                {addr.logradouro}, {addr.numero}
                {addr.complemento ? ` ${addr.complemento}` : ""}
              </span>
              <br />
              {addr.bairro} — {addr.cidade}/{addr.estado} — {addr.cep}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setAddress(EMPTY); setOptions(null); setSelected(null); }}
            className="text-xs text-muted-foreground underline self-start"
          >
            Usar outro endereço
          </button>
        </div>
      )}

      <form onSubmit={handleCalculate} className="flex flex-col gap-4">
        {/* CEP */}
        <div className="max-w-xs">
          <label htmlFor="cep" className={labelClass}>CEP *</label>
          <input
            id="cep"
            type="text"
            inputMode="numeric"
            placeholder="00000-000"
            value={address.cep}
            onChange={(e) => handleCepChange(e.target.value)}
            className={inputClass}
            maxLength={9}
            required
          />
          {isLooking && <p className="text-xs text-muted-foreground mt-1">Buscando endereço...</p>}
        </div>

        {addressReady && (
          <>
            <div>
              <label htmlFor="logradouro" className={labelClass}>Logradouro</label>
              <input
                id="logradouro" type="text" value={address.logradouro}
                onChange={(e) => setAddress((p) => ({ ...p, logradouro: e.target.value }))}
                className={inputClass} required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="numero" className={labelClass}>Número *</label>
                <input
                  id="numero" type="text" placeholder="123" value={address.numero}
                  onChange={(e) => setAddress((p) => ({ ...p, numero: e.target.value }))}
                  className={inputClass} required
                />
              </div>
              <div>
                <label htmlFor="complemento" className={labelClass}>Complemento</label>
                <input
                  id="complemento" type="text" placeholder="Apto 45" value={address.complemento}
                  onChange={(e) => setAddress((p) => ({ ...p, complemento: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="bairro" className={labelClass}>Bairro</label>
                <input
                  id="bairro" type="text" value={address.bairro}
                  onChange={(e) => setAddress((p) => ({ ...p, bairro: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="cidade" className={labelClass}>Cidade</label>
                <input
                  id="cidade" type="text" value={address.cidade}
                  onChange={(e) => setAddress((p) => ({ ...p, cidade: e.target.value }))}
                  className={inputClass} required
                />
              </div>
            </div>
            <div className="max-w-xs">
              <label htmlFor="estado" className={labelClass}>Estado (UF)</label>
              <input
                id="estado" type="text" value={address.estado}
                onChange={(e) => setAddress((p) => ({ ...p, estado: e.target.value.toUpperCase().slice(0, 2) }))}
                className={inputClass} maxLength={2} required
              />
            </div>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {addressReady && !options && (
          <button
            type="submit"
            disabled={isCalc || !address.numero.trim()}
            className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isCalc ? "Calculando frete..." : "Calcular Frete"}
          </button>
        )}
      </form>

      {/* Opções de frete */}
      {options && options.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">Opções de entrega</p>
          <div className="flex flex-col gap-2">
            {options.map((opt) => (
              <label
                key={opt.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selected === opt.id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"
                }`}
              >
                <input
                  type="radio" name="shipping" value={opt.id}
                  checked={selected === opt.id}
                  onChange={() => setSelected(opt.id)}
                  className="w-4 h-4 shrink-0"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {opt.company ? `${opt.company} ${opt.name}` : opt.name}
                  </p>
                  {(opt.deliveryMin > 0 || opt.deliveryMax > 0) && (
                    <p className="text-xs text-muted-foreground">
                      {opt.deliveryMin === opt.deliveryMax
                        ? `${opt.deliveryMin} dias úteis`
                        : `${opt.deliveryMin}–${opt.deliveryMax} dias úteis`}
                    </p>
                  )}
                </div>
                <span className={`text-sm font-semibold shrink-0 ${opt.priceCents === 0 ? "text-green-500" : "text-foreground"}`}>
                  {formatPrice(opt.priceCents)}
                </span>
              </label>
            ))}
          </div>

          {/* Checkbox salvar endereço */}
          {buyerWhatsapp && (
            <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground mt-1">
              <input
                type="checkbox"
                checked={saveAddr}
                onChange={(e) => setSaveAddr(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-input"
              />
              Salvar endereço para próximas compras
            </label>
          )}

          <button
            type="button"
            onClick={() => { setOptions(null); setSelected(null); }}
            className="text-xs text-muted-foreground underline self-start"
          >
            Alterar endereço
          </button>
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-3">
        <button
          type="button" onClick={onBack}
          className="flex-1 border border-border rounded-lg px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors"
        >
          Voltar
        </button>
        {options && selected && (
          <button
            type="button" onClick={handleNext}
            className="flex-1 bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Continuar
          </button>
        )}
      </div>
    </div>
  );
}
