"use client";

import { useState, useEffect, useRef } from "react";
import { lookupCustomer, saveCustomerData } from "@/app/actions/checkout";
import { usePhoneSession } from "@/hooks/usePhoneSession";
import { Loader2, CheckCircle2, UserPlus } from "lucide-react";

interface BuyerData {
  name: string;
  email: string;
  whatsapp: string;
}

type LookupState = "idle" | "loading" | "found" | "not-found";

function formatWhatsApp(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

interface BuyerInfoProps {
  buyer: BuyerData;
  onChange: (data: BuyerData) => void;
  onHoneypotChange?: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function BuyerInfo({ buyer, onChange, onHoneypotChange, onNext, onBack }: BuyerInfoProps) {
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [maskedName, setMaskedName] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof BuyerData, string>>>({});
  const lastLookedUp = useRef("");
  const { phone: savedPhone, setPhone: savePhone } = usePhoneSession();

  // Pré-preenche o WhatsApp se já foi digitado nesta sessão
  useEffect(() => {
    if (savedPhone && !buyer.whatsapp) {
      onChange({ ...buyer, whatsapp: savedPhone });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPhone]);

  function handleWhatsAppChange(raw: string) {
    const formatted = formatWhatsApp(raw);
    savePhone(formatted);
    onChange({ whatsapp: formatted, name: "", email: "" });
    setLookupState("idle");
    setMaskedName("");
    setMaskedEmail("");
    setErrors({});
  }

  useEffect(() => {
    const digits = buyer.whatsapp.replace(/\D/g, "");
    if (digits.length !== 11) return;
    if (lastLookedUp.current === digits) return;
    lastLookedUp.current = digits;

    setLookupState("loading");
    lookupCustomer(digits).then((result) => {
      if (result.found && result.name && result.email) {
        setMaskedName(result.maskedName ?? result.name);
        setMaskedEmail(result.maskedEmail ?? result.email);
        onChange({ whatsapp: buyer.whatsapp, name: result.name, email: result.email });
        setLookupState("found");
      } else {
        setLookupState("not-found");
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyer.whatsapp]);

  function validate(): boolean {
    const e: Partial<Record<keyof BuyerData, string>> = {};
    if (!buyer.name || buyer.name.trim().length < 2) e.name = "Nome muito curto";
    if (!buyer.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email))
      e.email = "E-mail inválido";
    if (!buyer.whatsapp || buyer.whatsapp.replace(/\D/g, "").length < 11)
      e.whatsapp = "WhatsApp inválido";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext() {
    if (!validate()) return;
    saveCustomerData(buyer.name, buyer.email, buyer.whatsapp);
    onNext();
  }

  const whatsappComplete = buyer.whatsapp.replace(/\D/g, "").length === 11;

  return (
    <div>
      <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-6">
        Seus Dados
      </h2>

      <input
        type="text"
        name="_hp"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        autoComplete="off"
        onChange={(e) => onHoneypotChange?.(e.target.value)}
      />

      <div className="space-y-4 mb-8">
        {/* WhatsApp — primeiro campo e identificador */}
        <div>
          <label htmlFor="buyer-whatsapp" className="block text-sm text-muted-foreground mb-1">
            WhatsApp *
          </label>
          <div className="relative">
            <input
              id="buyer-whatsapp"
              type="tel"
              value={buyer.whatsapp}
              placeholder="(67) 99999-9999"
              onChange={(e) => handleWhatsAppChange(e.target.value)}
              className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring pr-10"
            />
            {lookupState === "loading" && (
              <Loader2 size={16} className="absolute right-3 top-3 text-muted-foreground animate-spin" />
            )}
            {lookupState === "found" && (
              <CheckCircle2 size={16} className="absolute right-3 top-3 text-green-500" />
            )}
            {lookupState === "not-found" && whatsappComplete && (
              <UserPlus size={16} className="absolute right-3 top-3 text-muted-foreground" />
            )}
          </div>
          {errors.whatsapp && (
            <p className="text-destructive text-xs mt-1">{errors.whatsapp}</p>
          )}
        </div>

        {/* Cliente encontrado — dados mascarados para confirmar */}
        {lookupState === "found" && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <p className="text-xs text-green-400 font-semibold mb-2 uppercase tracking-wide">
              Cadastro encontrado
            </p>
            <p className="text-sm text-foreground">{maskedName}</p>
            <p className="text-sm text-muted-foreground">{maskedEmail}</p>
            <button
              onClick={() => {
                setLookupState("not-found");
                onChange({ whatsapp: buyer.whatsapp, name: "", email: "" });
              }}
              className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
            >
              Usar outros dados
            </button>
          </div>
        )}

        {/* Novos dados — nome e e-mail */}
        {(lookupState === "not-found" || lookupState === "idle") && whatsappComplete && (
          <>
            <div>
              <label htmlFor="buyer-name" className="block text-sm text-muted-foreground mb-1">
                Nome completo *
              </label>
              <input
                id="buyer-name"
                type="text"
                value={buyer.name}
                onChange={(e) => onChange({ ...buyer, name: e.target.value })}
                className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {errors.name && <p className="text-destructive text-xs mt-1">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="buyer-email" className="block text-sm text-muted-foreground mb-1">
                E-mail *
              </label>
              <input
                id="buyer-email"
                type="email"
                value={buyer.email}
                onChange={(e) => onChange({ ...buyer, email: e.target.value })}
                className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {errors.email && <p className="text-destructive text-xs mt-1">{errors.email}</p>}
            </div>
          </>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 bg-secondary text-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-secondary/80 transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={handleNext}
          disabled={!whatsappComplete || lookupState === "loading"}
          className="flex-1 py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
