"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
import { getMyMembership, cancelMyMembership, changeMyPlan } from "@/app/actions/account";
import { AsaasCardForm } from "@/components/membership/AsaasCardForm";

type Data = Awaited<ReturnType<typeof getMyMembership>>;
type CardData = {
  holderName: string; number: string; expiryMonth: string;
  expiryYear: string; ccv: string; postalCode: string; addressNumber: string;
};

const fmtBRL = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const fmtDay = (d: string) => d.split("-").reverse().join("/");

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "Ativo", cls: "bg-green-500/15 text-green-600" },
  pending: { label: "Aguardando pagamento", cls: "bg-yellow-500/15 text-yellow-600" },
  suspended: { label: "Suspenso — pagamento em atraso", cls: "bg-orange-500/15 text-orange-600" },
  cancelled: { label: "Cancelado", cls: "bg-destructive/15 text-destructive" },
};

/** Sócio na área logada: carteirinha, pagar em atraso, trocar plano, cancelar. */
export function MyMembership() {
  const [data, setData] = useState<Data | null>(null);
  const [view, setView] = useState<"main" | "change" | "card" | "cancel">("main");
  const [newPlanId, setNewPlanId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = () => getMyMembership().then(setData).catch(() => setData({ ok: false } as Data));
  useEffect(() => {
    load();
  }, []);

  if (!data) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (!data.ok || !("member" in data) || !data.member) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        <p className="mb-3">Você ainda não é sócio-torcedor com o e-mail desta conta.</p>
        <Link href="/socios/adesao" className="text-primary underline">Quero ser sócio</Link>
      </div>
    );
  }

  const m = data.member;
  const plans = data.plans ?? [];
  const st = STATUS[m.status] ?? STATUS.pending;
  const selected = plans.find((p) => p.id === newPlanId) ?? null;
  const nextDue = m.nextBillingDate ? fmtDate(m.nextBillingDate) : null;

  function runChange(method: "card" | "pix", card?: CardData) {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const r = await changeMyPlan({ planId: selected.id, method, asaasCardData: card });
      if (r.ok) {
        setDone(`Pronto! O plano ${r.planName} começa em ${fmtDay(r.startsOn!)}, com a 1ª mensalidade nessa data.`);
        setView("main");
        load();
      } else setError(r.error ?? "Não foi possível trocar de plano.");
    });
  }

  if (view === "card" && selected) {
    return (
      <AsaasCardForm
        amountCents={selected.priceCents}
        note={nextDue ? `1ª cobrança do novo plano em ${nextDue}. Nada é cobrado agora.` : undefined}
        submitLabel="Confirmar troca"
        isPending={isPending}
        error={error}
        onBack={() => { setView("change"); setError(null); }}
        onSubmit={(card) => runChange("card", card)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {done && (
        <p className="p-3 bg-green-500/10 border border-green-500/30 rounded-md text-sm text-foreground flex gap-2">
          <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" /> {done}
        </p>
      )}

      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Plano</p>
            <p className="text-foreground font-semibold">
              {m.plan?.name ?? "—"}
              {m.plan && <span className="text-muted-foreground font-normal text-sm"> · {fmtBRL(m.plan.priceCents)}/mês</span>}
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
        </div>
        {m.status === "active" && nextDue && (
          <p className="text-sm text-muted-foreground">Próxima mensalidade: <span className="text-foreground">{nextDue}</span></p>
        )}
        {m.status === "cancelled" && nextDue && new Date(m.nextBillingDate!) > new Date() && (
          <p className="text-sm text-muted-foreground">Benefícios até <span className="text-foreground">{nextDue}</span>.</p>
        )}
        {m.pendingPlan && (
          <p className="text-sm text-foreground">
            Troca agendada para <strong>{m.pendingPlan.name}</strong>{nextDue ? ` a partir de ${nextDue}` : ""}.
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {m.cardPath && (
            <Link href={m.cardPath} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
              Ver carteirinha
            </Link>
          )}
          {m.openInvoiceUrl && (
            <a href={m.openInvoiceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-sm">
              Pagar mensalidade <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>

      {m.canChangePlan && view !== "change" && plans.length > 1 && (
        <button type="button" onClick={() => { setView("change"); setDone(null); }} className="self-start text-sm text-primary underline">
          Trocar de plano
        </button>
      )}

      {view === "change" && (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
          <p className="text-sm font-semibold text-foreground">Escolha o novo plano</p>
          <p className="text-xs text-muted-foreground">
            Você continua no plano atual até {nextDue ?? "o fim do período pago"}. O novo plano começa — e é cobrado — nessa data. Sem cobrança dupla.
          </p>
          <div className="flex flex-col gap-2">
            {plans
              .filter((p) => p.id !== (m.pendingPlan?.id ?? m.plan?.id))
              .map((p) => (
                <label key={p.id} className={`flex items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer ${newPlanId === p.id ? "border-primary" : "border-border"}`}>
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <input type="radio" name="plan" value={p.id} checked={newPlanId === p.id} onChange={() => setNewPlanId(p.id)} />
                    {p.name}
                  </span>
                  <span className="text-sm text-muted-foreground">{fmtBRL(p.priceCents)}/mês</span>
                </label>
              ))}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!selected || isPending} onClick={() => { setError(null); setView("card"); }} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
              Pagar com cartão
            </button>
            <button type="button" disabled={!selected || isPending} onClick={() => runChange("pix")} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-sm disabled:opacity-50">
              {isPending && <Loader2 size={14} className="animate-spin" />} Pagar com PIX
            </button>
            <button type="button" onClick={() => { setView("main"); setError(null); }} className="px-3 py-2 text-sm text-muted-foreground underline">
              Voltar
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">No PIX, a cobrança chega por e-mail perto do vencimento.</p>
        </div>
      )}

      {m.status !== "cancelled" && view === "main" && (
        <button type="button" onClick={() => setView("cancel")} className="self-start text-xs text-muted-foreground underline">
          Cancelar assinatura
        </button>
      )}
      {view === "cancel" && (
        <div className="bg-card border border-destructive/40 rounded-xl p-5 flex flex-col gap-3">
          <p className="text-sm text-foreground">
            Cancelar a assinatura? As cobranças param.{" "}
            {m.status === "active" && nextDue ? `Seus benefícios continuam até ${nextDue}.` : "Os benefícios se encerram agora."}
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(async () => {
                setError(null);
                const r = await cancelMyMembership();
                if (r.ok) {
                  setDone(r.benefitsUntil ? `Assinatura cancelada. Benefícios até ${fmtDate(r.benefitsUntil)}.` : "Assinatura cancelada.");
                  setView("main");
                  load();
                } else setError(r.error ?? "Não foi possível cancelar.");
              })}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-destructive text-white text-sm font-semibold disabled:opacity-50"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />} Confirmar cancelamento
            </button>
            <button type="button" onClick={() => { setView("main"); setError(null); }} className="px-3 py-2 text-sm text-muted-foreground underline">
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
