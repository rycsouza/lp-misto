"use client";

import { useActionState } from "react";
import { acceptInvite } from "@/app/actions/admin-auth";

type AcceptState = { success: boolean; error?: string } | undefined;

async function acceptAction(
  _state: AcceptState,
  formData: FormData
): Promise<AcceptState> {
  return acceptInvite(formData);
}

interface AcceptInviteFormProps {
  token: string;
  name: string;
  email: string;
}

export function AcceptInviteForm({ token, name, email }: AcceptInviteFormProps) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(
    acceptAction,
    undefined
  );

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <p className="text-sm text-muted-foreground mb-6">
        Olá, <strong className="text-foreground">{name}</strong>! Crie sua senha para acessar o painel como <span className="text-primary">{email}</span>.
      </p>

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm text-muted-foreground">
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmPassword" className="text-sm text-muted-foreground">
            Confirmar Senha
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Repita a senha"
          />
        </div>

        {state && !state.success && state.error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {pending ? "Criando conta..." : "Criar Conta e Entrar"}
        </button>
      </form>
    </div>
  );
}
