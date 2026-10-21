"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { resetPassword } from "@/app/actions/account";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("t") ?? "";
  // ?novo=1: ativação da conta (1ª senha); senão, "esqueci a senha".
  const isNew = params.get("novo") === "1";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Link expirou ou já foi usado (o servidor não diz qual): oferece pedir outro.
  const [linkGone, setLinkGone] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-1">
        {isNew ? "Crie sua senha" : "Nova senha"}
      </h1>
      {token && !linkGone && (
        <p className="text-sm text-muted-foreground">
          {isNew
            ? "Escolha uma senha para ativar sua conta. Depois é só entrar com seu WhatsApp e esta senha."
            : "Escolha a nova senha da sua conta."}
        </p>
      )}
      {!token || linkGone ? (
        <div className="flex flex-col gap-3 mt-4">
          <p className="text-sm text-muted-foreground">
            {token ? "Este link expirou ou já foi usado." : "Este link está incompleto."} Peça um novo: enviamos um LINK ao
            e-mail cadastrado.
          </p>
          <Link
            href="/conta?esqueci=1"
            className="flex items-center justify-center w-full py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors"
          >
            Pedir um novo link
          </Link>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3 mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const r = await resetPassword({ token, password });
              if (r.ok) router.replace("/conta");
              else if (r.linkInvalid) setLinkGone(true);
              else setError(r.error ?? "Não foi possível salvar a senha.");
            });
          }}
        >
          <label className="text-sm text-muted-foreground" htmlFor="np">{isNew ? "Senha" : "Nova senha"}</label>
          <input
            id="np"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground -mt-1">Mínimo de 8 caracteres.</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md disabled:opacity-60"
          >
            {isPending && <Loader2 size={16} className="animate-spin" />} Salvar e entrar
          </button>
        </form>
      )}
    </div>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-sm mx-auto px-4 py-10">
        <Suspense>
          <ResetForm />
        </Suspense>
      </div>
    </main>
  );
}
