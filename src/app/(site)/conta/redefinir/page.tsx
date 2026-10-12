"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { resetPassword } from "@/app/actions/account";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("t") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-1">Nova senha</h1>
      {!token ? (
        <p className="text-sm text-muted-foreground">
          Link inválido. <Link href="/conta" className="underline">Peça um novo</Link>.
        </p>
      ) : (
        <form
          className="flex flex-col gap-3 mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const r = await resetPassword({ token, password });
              if (r.ok) router.replace("/conta");
              else setError(r.error ?? "Não foi possível redefinir.");
            });
          }}
        >
          <label className="text-sm text-muted-foreground" htmlFor="np">Nova senha</label>
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
