"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updateMyProfile, changeMyPassword } from "@/app/actions/account";
import { formatPhone } from "@/lib/accounts/identity";

const inputCls =
  "w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring";

/**
 * Meus dados: nome e troca de senha. WhatsApp (login) e e-mail (confirmado) são
 * fixos — conta antiga sem WhatsApp pode cadastrá-lo uma vez.
 */
export function MyProfile({ account }: { account: { name: string; email: string; whatsapp: string | null } }) {
  const [name, setName] = useState(account.name);
  const [whatsapp, setWhatsapp] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <form
        className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await updateMyProfile({ name, ...(account.whatsapp ? {} : { whatsapp }) });
            setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Salvo." : r.error ?? "Erro ao salvar." });
          });
        }}
      >
        <p className="text-sm font-semibold text-foreground">Meus dados</p>
        <label className="text-sm text-muted-foreground" htmlFor="pf-email">E-mail</label>
        <input id="pf-email" className={`${inputCls} opacity-70`} value={account.email} disabled />
        <label className="text-sm text-muted-foreground" htmlFor="pf-name">Nome</label>
        <input id="pf-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <label className="text-sm text-muted-foreground" htmlFor="pf-wa">WhatsApp {account.whatsapp && <span className="text-xs">(seu login)</span>}</label>
        {account.whatsapp ? (
          <input id="pf-wa" className={`${inputCls} opacity-70`} value={formatPhone(account.whatsapp)} disabled />
        ) : (
          <input id="pf-wa" type="tel" className={inputCls} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(67) 99999-9999" autoComplete="tel-national" />
        )}
        {msg && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-destructive"}`}>{msg.text}</p>}
        <button type="submit" disabled={isPending} className="self-start inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
          {isPending && <Loader2 size={14} className="animate-spin" />} Salvar
        </button>
      </form>

      <form
        className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await changeMyPassword({ current, next });
            setPwMsg({ ok: r.ok, text: r.ok ? r.message ?? "Senha alterada." : r.error ?? "Erro." });
            if (r.ok) { setCurrent(""); setNext(""); }
          });
        }}
      >
        <p className="text-sm font-semibold text-foreground">Trocar senha</p>
        <label className="text-sm text-muted-foreground" htmlFor="pw-cur">Senha atual</label>
        <input id="pw-cur" type="password" className={inputCls} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        <label className="text-sm text-muted-foreground" htmlFor="pw-new">Nova senha</label>
        <input id="pw-new" type="password" className={inputCls} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required />
        <p className="text-xs text-muted-foreground -mt-1">Mínimo de 8 caracteres. Outros aparelhos conectados serão desconectados.</p>
        {pwMsg && <p className={`text-sm ${pwMsg.ok ? "text-green-600" : "text-destructive"}`}>{pwMsg.text}</p>}
        <button type="submit" disabled={isPending} className="self-start inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-border text-sm disabled:opacity-50">
          {isPending && <Loader2 size={14} className="animate-spin" />} Trocar senha
        </button>
      </form>
    </div>
  );
}
