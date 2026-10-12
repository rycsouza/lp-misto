"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  loginAccount,
  signupAccount,
  requestPasswordReset,
  resendAccountVerification,
} from "@/app/actions/account";

type Mode = "login" | "signup" | "forgot";

const inputCls =
  "w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring";
const btnCls =
  "flex items-center justify-center gap-2 w-full py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60";

/** Entrar / Criar conta / Esqueci a senha. Comprar continua sem login. */
export function AccountAuth({ initialMode = "login", notice }: { initialMode?: Mode; notice?: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [hp, setHp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(notice ?? null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isPending, startTransition] = useTransition();

  function switchTo(m: Mode) {
    setMode(m);
    setError(null);
    setInfo(null);
    setNeedsVerification(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      if (mode === "login") {
        const r = await loginAccount({ email, password });
        if (r.ok) {
          router.refresh();
          return;
        }
        setNeedsVerification(!!r.needsVerification);
        setError(r.error ?? "Não foi possível entrar.");
      } else if (mode === "signup") {
        const r = await signupAccount({ name, email, password, whatsapp, _hp: hp });
        if (r.ok) {
          setInfo(r.message ?? "Enviamos um link de confirmação para o seu e-mail.");
          setPassword("");
        } else setError(r.error ?? "Não foi possível criar a conta.");
      } else {
        const r = await requestPasswordReset({ email });
        if (r.ok) setInfo(r.message ?? "Enviamos o link para o seu e-mail.");
        else setError(r.error ?? "Não foi possível enviar.");
      }
    });
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-1">
        {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Esqueci a senha"}
      </h1>
      <p className="text-sm text-muted-foreground mb-5">
        {mode === "forgot"
          ? "Informe o e-mail da conta e enviamos um link para criar uma nova senha."
          : "Acompanhe pedidos, ingressos e sua carteirinha de sócio. Comprar não exige conta."}
      </p>

      {info && <p className="p-3 mb-4 bg-primary/10 border border-primary/30 rounded-md text-sm text-foreground">{info}</p>}

      <form onSubmit={submit} className="flex flex-col gap-3">
        {mode === "signup" && (
          <>
            <label className="text-sm text-muted-foreground" htmlFor="acc-name">Nome completo</label>
            <input id="acc-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </>
        )}
        <label className="text-sm text-muted-foreground" htmlFor="acc-email">
          E-mail {mode === "signup" && <span className="text-xs">(use o mesmo das suas compras)</span>}
        </label>
        <input id="acc-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        {mode !== "forgot" && (
          <>
            <label className="text-sm text-muted-foreground" htmlFor="acc-pass">Senha</label>
            <input
              id="acc-pass"
              type="password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={mode === "signup" ? 8 : undefined}
              required
            />
            {mode === "signup" && <p className="text-xs text-muted-foreground -mt-1">Mínimo de 8 caracteres.</p>}
          </>
        )}
        {mode === "signup" && (
          <>
            <label className="text-sm text-muted-foreground" htmlFor="acc-wa">WhatsApp <span className="text-xs">(opcional)</span></label>
            <input id="acc-wa" type="tel" className={inputCls} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} autoComplete="tel" />
            <input type="text" value={hp} onChange={(e) => setHp(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {needsVerification && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline self-start"
            onClick={() => startTransition(async () => {
              const r = await resendAccountVerification({ email });
              setInfo(r.message ?? null);
            })}
          >
            Reenviar e-mail de confirmação
          </button>
        )}

        <button type="submit" disabled={isPending} className={`${btnCls} mt-2`}>
          {isPending && <Loader2 size={16} className="animate-spin" />}
          {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
        </button>
      </form>

      <div className="mt-5 flex flex-col items-center gap-2 text-sm">
        {mode !== "login" && (
          <button type="button" className="text-muted-foreground hover:text-foreground underline" onClick={() => switchTo("login")}>
            Já tenho conta — entrar
          </button>
        )}
        {mode !== "signup" && (
          <button type="button" className="text-primary hover:opacity-80 underline" onClick={() => switchTo("signup")}>
            Criar conta
          </button>
        )}
        {mode === "login" && (
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground underline" onClick={() => switchTo("forgot")}>
            Esqueci a senha
          </button>
        )}
      </div>
    </div>
  );
}
