"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { requestAffiliateLogin } from "@/app/actions/affiliate-auth";
import { Share2 } from "lucide-react";

type State = { success: boolean; error?: string } | undefined;

async function loginAction(_state: State, formData: FormData): Promise<State> {
  return requestAffiliateLogin(formData);
}

function LoginForm() {
  const [state, action, pending] = useActionState<State, FormData>(loginAction, undefined);
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const displayError = urlError ?? (state && !state.success ? state.error : undefined);

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      {state?.success ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Share2 size={20} className="text-primary" />
          </div>
          <h2 className="font-semibold text-foreground mb-2">Verifique seu e-mail</h2>
          <p className="text-sm text-muted-foreground">
            Se o e-mail informado estiver cadastrado, você receberá um link de acesso em instantes.
            O link é válido por 30 minutos.
          </p>
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm text-muted-foreground">
              E-mail cadastrado
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="seu@email.com"
            />
          </div>

          {displayError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {displayError}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {pending ? "Enviando..." : "Receber link de acesso"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function AffiliateLoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
            <Share2 size={24} className="text-primary" />
          </div>
          <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-foreground">
            Portal do Afiliado
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Misto Esporte Clube</p>
        </div>

        <Suspense fallback={<div className="bg-card border border-border rounded-xl p-6 h-40" />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Dúvidas?{" "}
          <a href="/" className="text-primary hover:opacity-80 transition-opacity">
            Entre em contato com a diretoria
          </a>
        </p>
      </div>
    </div>
  );
}
