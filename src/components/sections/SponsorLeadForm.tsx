"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createLead } from "@/app/actions/leads";

function formatWhatsApp(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const initialState = { success: false, error: undefined as string | undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
    >
      {pending ? "Enviando..." : "Enviar Interesse"}
    </button>
  );
}

export function SponsorLeadForm() {
  const action = createLead.bind(null, "sponsorship_interest");
  const [state, formAction] = useActionState(action, initialState);
  const [whatsapp, setWhatsapp] = useState("");

  if (state.success) {
    return (
      <div className="text-center py-8">
        <p className="text-primary font-semibold text-lg">
          Recebemos seu interesse! Entraremos em contato em breve.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 max-w-md mx-auto">
      <input type="text" name="_hp" className="hidden" tabIndex={-1} aria-hidden="true" />

      <div>
        <label htmlFor="sponsor-name" className="block text-sm text-muted-foreground mb-1">
          Nome / Empresa *
        </label>
        <input
          id="sponsor-name"
          type="text"
          name="name"
          required
          placeholder="João Silva ou Empresa Ltda."
          className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
        />
      </div>

      <div>
        <label htmlFor="sponsor-email" className="block text-sm text-muted-foreground mb-1">
          E-mail *
        </label>
        <input
          id="sponsor-email"
          type="email"
          name="email"
          required
          placeholder="contato@empresa.com.br"
          className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
        />
      </div>

      <div>
        <label htmlFor="sponsor-whatsapp" className="block text-sm text-muted-foreground mb-1">
          WhatsApp
        </label>
        <input
          id="sponsor-whatsapp"
          type="tel"
          name="whatsapp"
          value={whatsapp}
          placeholder="(67) 99999-9999"
          onChange={(e) => setWhatsapp(formatWhatsApp(e.target.value))}
          className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
        />
      </div>

      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
