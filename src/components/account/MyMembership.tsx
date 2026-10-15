"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, ExternalLink, CheckCircle2, Ticket, Wallet } from "lucide-react";
import {
  getMyMembership,
  cancelMyMembership,
  changeMyPlan,
  getMyFreeTickets,
  getMyGoogleWalletUrl,
  redeemMyFreeTicket,
  setMyWallOptIn,
} from "@/app/actions/account";
import { AsaasCardForm } from "@/components/membership/AsaasCardForm";
import { MemberCard } from "@/components/membership/MemberCard";
import { FREE_TICKET_BLOCK_MESSAGE } from "@/lib/membership/free-ticket-blocks";
import { wallNameProblem } from "@/lib/membership/wall-name";
import { TZ } from "@/lib/date";

type Data = Awaited<ReturnType<typeof getMyMembership>>;
type FreeData = Awaited<ReturnType<typeof getMyFreeTickets>>;
type CardData = {
  holderName: string; number: string; expiryMonth: string;
  expiryYear: string; ccv: string; postalCode: string; addressNumber: string;
};

const fmtBRL = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const fmtDay = (d: string) => d.split("-").reverse().join("/");
const fmtGameDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "Ativo", cls: "bg-green-500/15 text-green-600" },
  pending: { label: "Aguardando pagamento", cls: "bg-yellow-500/15 text-yellow-600" },
  suspended: { label: "Suspenso — pagamento em atraso", cls: "bg-orange-500/15 text-orange-600" },
  cancelled: { label: "Cancelado", cls: "bg-destructive/15 text-destructive" },
};

/** Sócio na área logada: carteirinha, pagar em atraso, trocar plano, cancelar. */
export function MyMembership({
  siteName,
  onGoToOrders,
}: {
  siteName?: string | null;
  /** Leva para a aba "Pedidos e ingressos" (onde fica o ingresso resgatado). */
  onGoToOrders?: () => void;
}) {
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

  function runChange(card: CardData) {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const r = await changeMyPlan({ planId: selected.id, asaasCardData: card });
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
        onSubmit={(card) => runChange(card)}
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

      {m.card ? (
        <div className="max-w-sm w-full mx-auto flex flex-col gap-3">
          <MemberCard card={m.card} siteName={siteName} invoiceUrl={m.openInvoiceUrl} />
          {data.googleWalletAvailable && m.card.hasBenefits && <SaveToGoogleWallet />}
        </div>
      ) : (
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
          {m.openInvoiceUrl && (
            <a href={m.openInvoiceUrl} target="_blank" rel="noopener noreferrer" className="self-start inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-sm">
              Pagar mensalidade <ExternalLink size={13} />
            </a>
          )}
        </div>
      )}

      {m.plan && (
        <p className="text-sm text-muted-foreground">
          Mensalidade: <span className="text-foreground">{fmtBRL(m.plan.priceCents)}</span>
          {m.status === "cancelled" && nextDue && new Date(m.nextBillingDate!) > new Date() && <> · benefícios até <span className="text-foreground">{nextDue}</span></>}
        </p>
      )}
      {m.pendingPlan && (
        <p className="text-sm text-foreground">
          Troca agendada para <strong>{m.pendingPlan.name}</strong>{nextDue ? ` a partir de ${nextDue}` : ""}.
        </p>
      )}

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
            <button type="button" onClick={() => { setView("main"); setError(null); }} className="px-3 py-2 text-sm text-muted-foreground underline">
              Voltar
            </button>
          </div>
        </div>
      )}

      {view === "main" && <FreeTicketsSection onGoToOrders={onGoToOrders} />}

      {view === "main" && (
        <WallSection
          accountName={m.accountName}
          wallName={m.wallName}
          active={m.status === "active"}
          onChanged={load}
        />
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

/**
 * Salvar a carteirinha no Google Carteira. O link (JWT assinado no servidor) é pedido
 * só no clique, não no render. O botão segue a identidade da Google (preto, PT-BR).
 */
function SaveToGoogleWallet() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await getMyGoogleWalletUrl();
      if (r.ok) window.location.assign(r.url);
      else setError(r.error);
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
      >
        {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Wallet size={16} aria-hidden="true" />}
        Salvar no Google Carteira
      </button>
      {error && <p role="alert" className="text-center text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * Mural dos sócios (opt-in, LGPD): liga ou desliga o próprio nome. Quando ligado,
 * aparece o nome da conta (não há nome livre); o servidor lê esse nome da sessão.
 * Só o nome vai ao público; o resto da conta não.
 */
function WallSection({
  accountName,
  wallName,
  active,
  onChanged,
}: {
  accountName: string;
  wallName: string | null;
  active: boolean;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const on = wallName !== null;
  // Nome da conta que não pode aparecer: a opção fica travada até o nome ser ajustado.
  const accountProblem = on ? null : wallNameProblem(accountName);

  function toggle() {
    setError(null);
    setFlash(null);
    startTransition(async () => {
      const r = await setMyWallOptIn({ optIn: !on });
      if (r.ok) {
        setFlash(r.message ?? "Pronto!");
        onChanged();
      } else {
        setError(r.error ?? "Não foi possível salvar agora.");
      }
    });
  }

  return (
    <section className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Mural dos sócios</p>
        <p className="text-sm text-foreground mt-1">
          {on ? (
            <>
              Seu nome aparece no mural como <strong>{wallName}</strong>.
            </>
          ) : (
            "Seu nome não aparece no mural."
          )}
        </p>
        {!active && (
          <p className="text-xs text-muted-foreground mt-1">O nome só aparece enquanto sua assinatura estiver ativa.</p>
        )}
      </div>

      {flash && (
        <p className="p-3 bg-green-500/10 border border-green-500/30 rounded-md text-sm text-foreground">{flash}</p>
      )}

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-primary"
          checked={on}
          disabled={isPending || (!on && !!accountProblem)}
          onChange={toggle}
        />
        <span className="text-sm text-foreground">
          Mostrar meu nome no Mural dos Sócios
          {!on && !accountProblem && (
            <span className="block text-xs text-muted-foreground mt-0.5">
              Vai aparecer como <strong>{accountName}</strong>, junto do seu plano.
            </span>
          )}
        </span>
      </label>

      {!on && accountProblem && (
        <p className="text-sm text-muted-foreground">
          Seu nome na conta não pode aparecer no mural. {accountProblem} Ajuste o nome em &quot;Meus dados&quot; para ativar.
        </p>
      )}

      <p className="text-[11px] text-muted-foreground">
        Para mudar o nome que aparece, edite seu nome em &quot;Meus dados&quot;. Nenhum outro dado seu é publicado.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/socios/mural" className="px-3 py-2 text-sm text-primary underline">
          Ver o mural
        </Link>
      </div>
    </section>
  );
}

/**
 * Ingressos de sócio: ingresso grátis por jogo em casa, resgatado pelo próprio
 * sócio (o servidor confere o plano, o pagamento da 1ª mensalidade e o limite).
 */
function FreeTicketsSection({ onGoToOrders }: { onGoToOrders?: () => void }) {
  const [data, setData] = useState<FreeData | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = () =>
    getMyFreeTickets()
      .then(setData)
      .catch(() => setData({ ok: false, error: "Não foi possível carregar seus ingressos." }));
  useEffect(() => {
    load();
  }, []);

  if (!data) return null;
  if (!data.ok) return <p className="text-xs text-muted-foreground">{data.error}</p>;
  if (!data.eligible) return null;

  function redeem(gameId: string) {
    setFlash(null);
    setPendingId(gameId);
    startTransition(async () => {
      const r = await redeemMyFreeTicket({ gameId });
      setPendingId(null);
      setFlash(r.ok
        ? { ok: true, text: r.message ?? "Ingresso resgatado!" }
        : { ok: false, text: r.error ?? "Não foi possível resgatar agora." });
      await load();
    });
  }

  const { perGame, games } = data;

  return (
    <section className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Ingressos de sócio</p>
        <p className="text-sm text-foreground mt-1">
          Seu plano dá {perGame} ingresso{perGame > 1 ? "s" : ""} por jogo em casa.
        </p>
      </div>

      {flash && (
        <div
          className={`p-3 rounded-md text-sm flex flex-wrap items-center gap-2 ${
            flash.ok ? "bg-green-500/10 border border-green-500/30 text-foreground" : "bg-destructive/10 border border-destructive/30 text-destructive"
          }`}
        >
          <span className="flex gap-2">
            {flash.ok && <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />}
            {flash.text}
          </span>
          {flash.ok && onGoToOrders && (
            <button type="button" onClick={onGoToOrders} className="text-primary underline text-sm">
              Ver em Pedidos e ingressos
            </button>
          )}
        </div>
      )}

      {games.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum jogo em casa com vendas abertas no momento.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {games.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-border">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">vs {g.opponent}</p>
                <p className="text-xs text-muted-foreground">
                  {g.competition ? `${g.competition} · ` : ""}
                  {fmtGameDate(g.date)} · {g.venue}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {g.used > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                    <CheckCircle2 size={13} /> Resgatado · {g.used} de {g.limit}
                  </span>
                )}
                {g.canRedeem ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => redeem(g.id)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                  >
                    {pendingId === g.id ? <Loader2 size={14} className="animate-spin" /> : <Ticket size={14} />}
                    Resgatar ingresso ({g.used + 1} de {g.limit})
                  </button>
                ) : (
                  g.block && <span className="text-xs text-muted-foreground text-right">{FREE_TICKET_BLOCK_MESSAGE[g.block]}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
