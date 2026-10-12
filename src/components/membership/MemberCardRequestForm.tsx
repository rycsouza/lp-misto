"use client";

import { useState, useTransition } from "react";
import { Loader2, Mail } from "lucide-react";
import { requestMemberCardLink } from "@/app/actions/membership";

/** "Minha carteirinha": envia o link da carteirinha para o e-mail cadastrado. */
export function MemberCardRequestForm() {
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await requestMemberCardLink({ email, _hp: hp });
      if (!r.ok) {
        setError(r.error ?? "Não foi possível enviar agora. Tente novamente.");
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="text-center">
        <Mail size={32} className="mx-auto text-primary mb-3" />
        <p className="text-foreground font-semibold mb-1">Confira seu e-mail</p>
        <p className="text-sm text-muted-foreground">
          Se houver uma assinatura de sócio com <strong className="text-foreground">{email}</strong>, enviamos o link
          da carteirinha. Veja também a caixa de spam.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-4 text-xs text-muted-foreground underline hover:text-foreground"
        >
          Usar outro e-mail
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="member-email" className="text-sm text-muted-foreground">
        E-mail usado na adesão
      </label>
      <input
        id="member-email"
        type="email"
        required
        autoComplete="email"
        placeholder="voce@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <input
        type="text"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={isPending || !email.trim()}
        className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
        Receber link por e-mail
      </button>
    </form>
  );
}
