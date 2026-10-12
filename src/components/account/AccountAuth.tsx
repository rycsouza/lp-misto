"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  loginAccount,
  signupAccount,
  requestPasswordReset,
  resendAccountVerification,
} from "@/app/actions/account";
import { lookupCustomer } from "@/app/actions/checkout";
import { usePhoneSession } from "@/hooks/usePhoneSession";

type Mode = "login" | "signup" | "forgot";
type Lookup = "idle" | "loading" | "found" | "not-found";

const inputCls =
  "w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring";
const btnCls =
  "flex items-center justify-center gap-2 w-full py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60";

function formatWhatsApp(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Entrar / Criar conta / Esqueci a senha — tudo pelo WhatsApp, o mesmo do
 * checkout. No cadastro, se o WhatsApp já tem compras, nome e e-mail vêm do
 * cadastro; senão, a pessoa informa. A senha é criada pelo link do e-mail.
 */
export function AccountAuth({ initialMode = "login", notice }: { initialMode?: Mode; notice?: string | null }) {
  const router = useRouter();
  const { phone: savedPhone, setPhone: savePhone } = usePhoneSession();
  const [mode, setMode] = useState<Mode>(initialMode);
  // Login aceita WhatsApp (ou e-mail, para contas antigas). Enquanto a pessoa não
  // digita, usa o WhatsApp já informado neste aparelho (ex.: acabou de comprar).
  const [loginInput, setLogin] = useState<string | null>(null);
  const [whatsappInput, setWhatsapp] = useState<string | null>(null);
  const login = loginInput ?? savedPhone;
  const whatsapp = whatsappInput ?? (/[a-z@]/i.test(login) ? "" : formatWhatsApp(login));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hp, setHp] = useState("");
  const [lookupResult, setLookup] = useState<{ digits: string; state: Lookup }>({ digits: "", state: "idle" });
  const [maskedEmail, setMaskedEmail] = useState("");
  const lastLookedUp = useRef("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(notice ?? null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Cadastro: WhatsApp completo → já tem compras? (só dados mascarados)
  const signupDigits = whatsapp.replace(/\D/g, "");
  useEffect(() => {
    if (mode !== "signup" || signupDigits.length !== 11) return;
    if (lastLookedUp.current === signupDigits) return;
    lastLookedUp.current = signupDigits;
    let alive = true;
    lookupCustomer(signupDigits)
      .then((r) => {
        if (!alive) return;
        setMaskedEmail(r.found ? r.maskedEmail ?? "" : "");
        setLookup({ digits: signupDigits, state: r.found ? "found" : "not-found" });
      })
      .catch(() => alive && setLookup({ digits: signupDigits, state: "not-found" }));
    return () => {
      alive = false;
      lastLookedUp.current = "";
    };
  }, [mode, signupDigits]);
  // Resultado só vale para o número que está no campo.
  const lookup: Lookup =
    signupDigits.length !== 11 ? "idle" : lookupResult.digits === signupDigits ? lookupResult.state : "loading";

  function switchTo(m: Mode) {
    setMode(m);
    setError(null);
    setInfo(null);
    setNeedsVerification(false);
  }

  function onLoginChange(v: string) {
    // Só formata como telefone se não for e-mail.
    setLogin(/[a-z@]/i.test(v) ? v : formatWhatsApp(v));
  }

  const loginPhone = !/[a-z@]/i.test(login);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      if (mode === "login") {
        if (loginPhone) savePhone(login);
        const r = await loginAccount({ login, password });
        if (r.ok) {
          router.refresh();
          return;
        }
        setNeedsVerification(!!r.needsVerification);
        setError(r.error ?? "Não foi possível entrar.");
      } else if (mode === "signup") {
        savePhone(whatsapp);
        const r = await signupAccount({
          whatsapp,
          ...(lookup === "found" ? {} : { name, email }),
          _hp: hp,
        });
        if (r.ok) setInfo(r.message ?? "Enviamos o link para você criar sua senha. Confira seu e-mail.");
        else setError(r.error ?? "Não foi possível criar a conta.");
      } else {
        const r = await requestPasswordReset({ whatsapp: login });
        if (r.ok) setInfo(r.message ?? "Enviamos o link para o seu e-mail.");
        else setError(r.error ?? "Não foi possível enviar.");
      }
    });
  }

  const signupReady = mode !== "signup" || lookup === "found" || lookup === "not-found";

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-1">
        {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Esqueci a senha"}
      </h1>
      <p className="text-sm text-muted-foreground mb-5">
        {mode === "forgot"
          ? "Informe o WhatsApp da conta e enviamos um link para o e-mail cadastrado."
          : "Seus pedidos, ingressos e carteirinha de sócio em um só lugar."}
      </p>

      {info && <p className="p-3 mb-4 bg-primary/10 border border-primary/30 rounded-md text-sm text-foreground">{info}</p>}

      <form onSubmit={submit} className="flex flex-col gap-3">
        {mode === "signup" ? (
          <>
            <label className="text-sm text-muted-foreground" htmlFor="acc-wa">
              WhatsApp <span className="text-xs">(o mesmo das suas compras)</span>
            </label>
            <div className="relative">
              <input
                id="acc-wa"
                type="tel"
                inputMode="tel"
                className={`${inputCls} pr-10`}
                placeholder="(67) 99999-9999"
                value={whatsapp}
                onChange={(e) => setWhatsapp(formatWhatsApp(e.target.value))}
                autoComplete="tel-national"
                required
              />
              {lookup === "loading" && <Loader2 size={16} className="absolute right-3 top-3 text-muted-foreground animate-spin" />}
              {lookup === "found" && <CheckCircle2 size={16} className="absolute right-3 top-3 text-green-500" />}
            </div>

            {lookup === "found" && (
              <p className="p-3 bg-green-500/10 border border-green-500/30 rounded-md text-xs text-foreground">
                Encontramos seu cadastro. Enviaremos para <strong>{maskedEmail}</strong> o link para criar sua senha.
              </p>
            )}
            {lookup === "not-found" && (
              <>
                <label className="text-sm text-muted-foreground" htmlFor="acc-name">Nome completo</label>
                <input id="acc-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
                <label className="text-sm text-muted-foreground" htmlFor="acc-email">E-mail</label>
                <input id="acc-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </>
            )}
            <input type="text" value={hp} onChange={(e) => setHp(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          </>
        ) : (
          <>
            <label className="text-sm text-muted-foreground" htmlFor="acc-login">WhatsApp</label>
            <input
              id="acc-login"
              type="text"
              inputMode={loginPhone ? "tel" : "email"}
              className={inputCls}
              placeholder="(67) 99999-9999"
              value={login}
              onChange={(e) => onLoginChange(e.target.value)}
              autoComplete="username"
              required
            />
          </>
        )}

        {mode === "login" && (
          <>
            <label className="text-sm text-muted-foreground" htmlFor="acc-pass">Senha</label>
            <input
              id="acc-pass"
              type="password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </>
        )}
        {mode === "signup" && lookup === "not-found" && (
          <p className="text-xs text-muted-foreground -mt-1">Você cria a senha pelo link que enviaremos a este e-mail.</p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {needsVerification && loginPhone && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline self-start"
            onClick={() => startTransition(async () => {
              const r = await resendAccountVerification({ whatsapp: login });
              setInfo(r.message ?? null);
            })}
          >
            Reenviar e-mail de confirmação
          </button>
        )}

        <button type="submit" disabled={isPending || !signupReady} className={`${btnCls} mt-2`}>
          {isPending && <Loader2 size={16} className="animate-spin" />}
          {mode === "login" ? "Entrar" : mode === "signup" ? "Continuar" : "Enviar link"}
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
