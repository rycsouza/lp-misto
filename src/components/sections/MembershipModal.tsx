"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { X } from "lucide-react";
import { createLead } from "@/app/actions/leads";

interface Plan {
  slug: string;
  name: string;
  price: string;
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
      {pending ? "Enviando..." : "Confirmar Interesse"}
    </button>
  );
}

function LeadForm({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const action = createLead.bind(null, "membership_interest");
  const [state, formAction] = useActionState(action, initialState);

  if (state.success) {
    return (
      <div className="text-center py-8">
        <p className="text-primary font-semibold text-lg mb-4">
          Interesse registrado! Entraremos em contato em breve.
        </p>
        <button
          onClick={onClose}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          Fechar
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="text" name="_hp" className="hidden" tabIndex={-1} aria-hidden="true" />
      <input type="hidden" name="metadata" value={JSON.stringify({ plan: plan.slug, planName: plan.name })} />
      <div>
        <label htmlFor="member-name" className="block text-sm text-muted-foreground mb-1">
          Nome completo *
        </label>
        <input
          id="member-name"
          type="text"
          name="name"
          required
          className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div>
        <label htmlFor="member-email" className="block text-sm text-muted-foreground mb-1">
          E-mail *
        </label>
        <input
          id="member-email"
          type="email"
          name="email"
          required
          className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div>
        <label htmlFor="member-whatsapp" className="block text-sm text-muted-foreground mb-1">
          WhatsApp
        </label>
        <input
          id="member-whatsapp"
          type="tel"
          name="whatsapp"
          className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}

export function MembershipInterestButton({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-lg rounded-md hover:bg-primary/90 hover:shadow-[0_0_15px_rgba(193,154,90,0.4)] transition-all"
      >
        Tenho Interesse
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
            <h3 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground mb-1">
              Plano {plan.name}
            </h3>
            <p className="text-primary font-semibold mb-6">{plan.price}/mês</p>
            <LeadForm plan={plan} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
