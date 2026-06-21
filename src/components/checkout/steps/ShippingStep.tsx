"use client";

import { useState, useTransition } from "react";
import { lookupAddress, getShippingOptions } from "@/app/actions/shipping";
import type { ShippingAddress, ShippingOption, CartItemForShipping } from "@/app/actions/shipping";

export type { ShippingAddress, ShippingOption };

interface ShippingStepProps {
  cartItems: CartItemForShipping[];
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
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function ShippingStep({ cartItems, initial, onNext, onBack }: ShippingStepProps) {
  const [address, setAddress] = useState<ShippingAddress>(
    initial?.address ?? {
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
    }
  );
  const [options, setOptions] = useState<ShippingOption[] | null>(
    initial?.option ? [initial.option] : null
  );
  const [selected, setSelected] = useState<string | null>(initial?.option?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isLooking, startLookup] = useTransition();
  const [isCalc, startCalc] = useTransition();

  const inputClass =
    "bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring w-full";
  const labelClass = "text-sm text-muted-foreground mb-1 block";

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
      const opts = await getShippingOptions(address.cep, cartItems);
      if (opts.length === 0) {
        setError(
          "Não foi possível calcular o frete para este CEP. Verifique se o CEP está correto ou entre em contato."
        );
      } else {
        setOptions(opts);
        setSelected(opts[0].id);
      }
    });
  }

  function handleNext() {
    const opt = options?.find((o) => o.id === selected);
    if (!opt) return;
    onNext(address, opt);
  }

  const cepDigits = address.cep.replace(/\D/g, "");
  const addressReady = cepDigits.length === 8 && !!address.logradouro;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCalculate} className="flex flex-col gap-4">
        {/* CEP */}
        <div className="max-w-xs">
          <label htmlFor="cep" className={labelClass}>
            CEP *
          </label>
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
          {isLooking && (
            <p className="text-xs text-muted-foreground mt-1">Buscando endereço...</p>
          )}
        </div>

        {/* Campos preenchidos pelo ViaCEP */}
        {addressReady && (
          <>
            <div>
              <label htmlFor="logradouro" className={labelClass}>
                Logradouro
              </label>
              <input
                id="logradouro"
                type="text"
                value={address.logradouro}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, logradouro: e.target.value }))
                }
                className={inputClass}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="numero" className={labelClass}>
                  Número *
                </label>
                <input
                  id="numero"
                  type="text"
                  placeholder="123"
                  value={address.numero}
                  onChange={(e) =>
                    setAddress((prev) => ({ ...prev, numero: e.target.value }))
                  }
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label htmlFor="complemento" className={labelClass}>
                  Complemento
                </label>
                <input
                  id="complemento"
                  type="text"
                  placeholder="Apto 45"
                  value={address.complemento}
                  onChange={(e) =>
                    setAddress((prev) => ({ ...prev, complemento: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="bairro" className={labelClass}>
                  Bairro
                </label>
                <input
                  id="bairro"
                  type="text"
                  value={address.bairro}
                  onChange={(e) =>
                    setAddress((prev) => ({ ...prev, bairro: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="cidade" className={labelClass}>
                  Cidade
                </label>
                <input
                  id="cidade"
                  type="text"
                  value={address.cidade}
                  onChange={(e) =>
                    setAddress((prev) => ({ ...prev, cidade: e.target.value }))
                  }
                  className={inputClass}
                  required
                />
              </div>
            </div>
            <div className="max-w-xs">
              <label htmlFor="estado" className={labelClass}>
                Estado (UF)
              </label>
              <input
                id="estado"
                type="text"
                value={address.estado}
                onChange={(e) =>
                  setAddress((prev) => ({
                    ...prev,
                    estado: e.target.value.toUpperCase().slice(0, 2),
                  }))
                }
                className={inputClass}
                maxLength={2}
                required
              />
            </div>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Botão calcular: aparece após endereço pronto e antes das opções */}
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
                  selected === opt.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-secondary/50"
                }`}
              >
                <input
                  type="radio"
                  name="shipping"
                  value={opt.id}
                  checked={selected === opt.id}
                  onChange={() => setSelected(opt.id)}
                  className="w-4 h-4 shrink-0"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {opt.company} {opt.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {opt.deliveryMin === opt.deliveryMax
                      ? `${opt.deliveryMin} dias úteis`
                      : `${opt.deliveryMin}–${opt.deliveryMax} dias úteis`}
                  </p>
                </div>
                <span className="text-sm font-semibold text-foreground shrink-0">
                  {formatPrice(opt.priceCents)}
                </span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOptions(null)}
            className="text-xs text-muted-foreground underline self-start"
          >
            Alterar endereço
          </button>
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 border border-border rounded-lg px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors"
        >
          Voltar
        </button>
        {options && selected && (
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Continuar
          </button>
        )}
      </div>
    </div>
  );
}
