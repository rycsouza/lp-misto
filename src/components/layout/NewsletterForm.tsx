"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createLead } from "@/app/actions/leads";

const initialState = { success: false, error: undefined as string | undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-r-md hover:bg-primary/90 transition-colors disabled:opacity-60"
    >
      {pending ? "..." : "Assinar"}
    </button>
  );
}

export function NewsletterForm() {
  const action = createLead.bind(null, "newsletter");
  const [state, formAction] = useActionState(action, initialState);

  if (state.success) {
    return <p className="text-sm text-primary">Cadastrado com sucesso!</p>;
  }

  return (
    <form action={formAction} className="flex">
      <input type="text" name="_hp" className="hidden" tabIndex={-1} aria-hidden="true" />
      <input type="hidden" name="name" value="Inscrito newsletter" />
      <input
        type="email"
        name="email"
        required
        placeholder="Seu e-mail"
        className="flex-1 px-3 py-2 bg-input text-sm rounded-l-md border border-border focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <SubmitButton />
      {state.error && <p className="text-destructive text-xs mt-1">{state.error}</p>}
    </form>
  );
}
