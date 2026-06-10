"use client";

import { useState } from "react";

interface BuyerData {
  name: string;
  email: string;
  whatsapp: string;
}

interface BuyerInfoProps {
  buyer: BuyerData;
  onChange: (data: BuyerData) => void;
  onNext: () => void;
  onBack: () => void;
}

export function BuyerInfo({ buyer, onChange, onNext, onBack }: BuyerInfoProps) {
  const [errors, setErrors] = useState<Partial<BuyerData>>({});

  function validate(): boolean {
    const e: Partial<BuyerData> = {};
    if (!buyer.name || buyer.name.trim().length < 2) e.name = "Nome muito curto";
    if (!buyer.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email))
      e.email = "E-mail inválido";
    if (!buyer.whatsapp || buyer.whatsapp.replace(/\D/g, "").length < 10)
      e.whatsapp = "WhatsApp inválido";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext() {
    if (validate()) onNext();
  }

  return (
    <div>
      <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-6">
        Seus Dados
      </h2>

      <input type="text" name="_hp" className="hidden" tabIndex={-1} aria-hidden="true" />

      <div className="space-y-4 mb-8">
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
        <div>
          <label htmlFor="buyer-whatsapp" className="block text-sm text-muted-foreground mb-1">
            WhatsApp *
          </label>
          <input
            id="buyer-whatsapp"
            type="tel"
            value={buyer.whatsapp}
            placeholder="(67) 99999-9999"
            onChange={(e) => onChange({ ...buyer, whatsapp: e.target.value })}
            className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {errors.whatsapp && (
            <p className="text-destructive text-xs mt-1">{errors.whatsapp}</p>
          )}
        </div>
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
          className="flex-1 py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
