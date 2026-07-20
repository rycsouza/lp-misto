"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Minus, Plus, Loader2, Copy, CheckCircle2, Clock, Ticket, X, UserPlus } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { createRaffleOrder, checkPaymentStatus, lookupCustomer, saveCustomerData } from "@/app/actions/checkout";
import { usePhoneSession } from "@/hooks/usePhoneSession";

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function fmtWhats(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const inputClass =
  "w-full bg-input border border-border rounded-lg px-4 py-3 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";

// Piso do gateway (Asaas rejeita cobranças abaixo de R$ 5,00). Espelha o backend.
const MIN_CHARGE_CENTS = 500;

type Phase = "idle" | "form" | "pix" | "done";
type Lookup = "idle" | "loading" | "found" | "not-found";

export function RaffleBuy({
  raffleId,
  priceCents,
  availableCount,
  maxPerCustomer,
  status,
}: {
  raffleId: string;
  priceCents: number;
  availableCount: number;
  maxPerCustomer: number | null;
  status: "active" | "closed" | "drawn";
}) {
  // Quantidade mínima para atingir o piso do gateway (ex.: número de R$ 1 → mín. 5).
  const minQty = Math.max(1, Math.ceil(MIN_CHARGE_CENTS / priceCents));

  const [phase, setPhase] = useState<Phase>("idle");
  const [qty, setQty] = useState(minQty);

  const { phone: savedPhone, setPhone: savePhone } = usePhoneSession();
  const [whatsapp, setWhatsapp] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [hp, setHp] = useState("");
  const [lookup, setLookup] = useState<Lookup>("idle");
  const [maskedName, setMaskedName] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [hasCpf, setHasCpf] = useState(false);
  const lastLookedUp = useRef("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [order, setOrder] = useState<{
    paymentId: string;
    pixQrCode?: string;
    pixQrCodeUrl?: string;
    reservedQuantity?: number;
    requestedQuantity?: number;
  } | null>(null);
  const idemRef = useRef<string>("");

  const cap = Math.min(maxPerCustomer ?? Infinity, availableCount, 5000);
  const whatsappComplete = whatsapp.replace(/\D/g, "").length === 11;

  // Prefill do WhatsApp já usado no dispositivo (cookie/localStorage).
  useEffect(() => {
    if (savedPhone && !whatsapp) setWhatsapp(savedPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPhone]);

  // Lookup de cadastro ao completar o WhatsApp (whatsapp-first, igual aos outros checkouts).
  useEffect(() => {
    const digits = whatsapp.replace(/\D/g, "");
    if (digits.length !== 11) { setLookup("idle"); return; }
    if (lastLookedUp.current === digits) return;
    lastLookedUp.current = digits;
    setLookup("loading");
    lookupCustomer(digits).then((r) => {
      if (r.found && r.name && r.email) {
        setName(r.name);
        setEmail(r.email);
        setMaskedName(r.maskedName ?? r.name);
        setMaskedEmail(r.maskedEmail ?? r.email);
        setHasCpf(!!r.hasCpf);
        setLookup("found");
      } else {
        setName("");
        setEmail("");
        setHasCpf(false);
        setLookup("not-found");
      }
    }).catch(() => setLookup("not-found"));
  }, [whatsapp]);

  // Polling do pagamento.
  useEffect(() => {
    if (phase !== "pix" || !order?.paymentId) return;
    const id = setInterval(async () => {
      const st = await checkPaymentStatus(order.paymentId);
      if (st === "paid") { clearInterval(id); setPhase("done"); }
      else if (st === "failed") { clearInterval(id); setError("O PIX expirou ou falhou. Tente novamente."); setPhase("form"); }
    }, 12000);
    return () => clearInterval(id);
  }, [phase, order?.paymentId]);

  function closeModal() {
    if (phase === "done") { window.location.reload(); return; }
    setPhase("idle");
    setError(null);
  }

  async function submit() {
    setError(null);
    if (!whatsappComplete) { setError("Informe um WhatsApp válido."); return; }
    if (!name.trim() || !email.trim()) { setError("Preencha nome e e-mail."); return; }
    if (!idemRef.current) idemRef.current = crypto.randomUUID();
    savePhone(fmtWhats(whatsapp));
    saveCustomerData(name.trim(), email.trim(), whatsapp.replace(/\D/g, ""));
    setLoading(true);
    const r = await createRaffleOrder({
      raffleId,
      quantity: qty,
      buyer: { name: name.trim(), email: email.trim(), whatsapp: whatsapp.replace(/\D/g, "") },
      customerCpf: cpf.replace(/\D/g, "") || undefined,
      _hp: hp,
      idempotencyKey: idemRef.current,
    });
    setLoading(false);
    if (!r.success) { setError(r.error ?? "Não foi possível processar."); return; }
    setOrder({ paymentId: r.paymentId!, pixQrCode: r.pixQrCode, pixQrCodeUrl: r.pixQrCodeUrl, reservedQuantity: r.reservedQuantity, requestedQuantity: r.requestedQuantity });
    setPhase("pix");
  }

  if (status !== "active" || availableCount === 0 || availableCount < minQty) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 text-center">
        <p className="text-sm text-muted-foreground">
          {status === "drawn"
            ? "Este sorteio já foi realizado."
            : status === "closed"
              ? "As vendas deste sorteio foram encerradas."
              : availableCount === 0
                ? "Números esgotados."
                : "Poucos números restantes — abaixo do mínimo de compra."}
        </p>
      </div>
    );
  }

  // Seletor de quantidade + total + CTA — reutilizado na barra (mobile) e no card (desktop).
  const trigger = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground hidden sm:inline lg:hidden xl:inline">Quantos números?</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setQty((q) => Math.max(minQty, q - 1))} disabled={qty <= minQty} className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:bg-secondary disabled:opacity-40" aria-label="Menos"><Minus size={16} /></button>
          <span className="w-10 text-center font-semibold text-lg tabular-nums">{qty}</span>
          <button onClick={() => setQty((q) => Math.min(cap, q + 1))} disabled={qty >= cap} className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:bg-secondary disabled:opacity-40" aria-label="Mais"><Plus size={16} /></button>
        </div>
      </div>
      <button
        onClick={() => setPhase("form")}
        className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-3 px-5 text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
      >
        Participar · {brl(qty * priceCents)}
      </button>
    </>
  );

  return (
    <>
      {/* Card inline (desktop) */}
      <div className="hidden lg:flex flex-col gap-3 bg-card border border-border rounded-xl p-5">
        {trigger}
        {minQty > 1 && (
          <p className="text-xs text-muted-foreground text-center">Compra mínima: {minQty} números ({brl(MIN_CHARGE_CENTS)}).</p>
        )}
      </div>

      {/* Barra flutuante (mobile/tablet) */}
      <div
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 px-4 pointer-events-none"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="pointer-events-auto max-w-xl mx-auto flex items-center gap-3 bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-lg shadow-black/30 p-3">
          {trigger}
        </div>
      </div>

      {/* Modal de compra (whatsapp-first → PIX → sucesso) */}
      {phase !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
          <div className="relative w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto p-5">
            <button onClick={closeModal} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1" aria-label="Fechar"><X size={20} /></button>

            {/* ── FORM (dados) ── */}
            {phase === "form" && (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground">Participar do sorteio</p>
                  <p className="text-sm text-muted-foreground">{qty} {qty === 1 ? "número" : "números"} · <span className="text-foreground font-semibold">{brl(qty * priceCents)}</span>{minQty > 1 ? ` · mín. ${minQty}` : ""}</p>
                </div>

                {/* WhatsApp primeiro (identificador) */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">WhatsApp</label>
                  <div className="relative">
                    <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(fmtWhats(e.target.value))} placeholder="(67) 99999-9999" className={`${inputClass} pr-10`} />
                    {lookup === "loading" && <Loader2 size={16} className="absolute right-3 top-3.5 text-muted-foreground animate-spin" />}
                    {lookup === "found" && <CheckCircle2 size={16} className="absolute right-3 top-3.5 text-green-500" />}
                    {lookup === "not-found" && whatsappComplete && <UserPlus size={16} className="absolute right-3 top-3.5 text-muted-foreground" />}
                  </div>
                </div>

                {/* Cadastro encontrado → confirma mascarado */}
                {lookup === "found" && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                    <p className="text-xs text-green-400 font-semibold mb-1 uppercase tracking-wide">Cadastro encontrado</p>
                    <p className="text-sm text-foreground">{maskedName}</p>
                    <p className="text-sm text-muted-foreground">{maskedEmail}</p>
                    <button onClick={() => { setLookup("not-found"); setName(""); setEmail(""); setHasCpf(false); }} className="mt-1.5 text-xs text-muted-foreground underline hover:text-foreground">
                      Usar outros dados
                    </button>
                  </div>
                )}

                {/* Sem cadastro → nome + e-mail */}
                {(lookup === "not-found" || (lookup === "idle" && whatsappComplete)) && (
                  <>
                    <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
                    <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" />
                  </>
                )}

                {/* CPF só quando não temos na base — cadastro com CPF salvo é reusado no backend. */}
                {whatsappComplete && !(lookup === "found" && hasCpf) && (
                  <input className={inputClass} value={cpf} onChange={(e) => setCpf(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="CPF (se solicitado no pagamento)" inputMode="numeric" />
                )}

                <input type="text" value={hp} onChange={(e) => setHp(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />

                {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

                <button
                  onClick={submit}
                  disabled={loading || !whatsappComplete || lookup === "loading" || !name.trim() || !email.trim()}
                  className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  Gerar PIX
                </button>
              </div>
            )}

            {/* ── PIX ── */}
            {phase === "pix" && order && (
              <div className="flex flex-col items-center gap-4 pt-2">
                <p className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground">Pague com PIX</p>
                {order.requestedQuantity != null && order.reservedQuantity != null && order.reservedQuantity < order.requestedQuantity && (
                  <p className="text-xs text-yellow-500 bg-yellow-500/10 rounded-lg px-3 py-2 text-center">
                    Restavam só {order.reservedQuantity} números — cobramos apenas por eles.
                  </p>
                )}
                <p className="text-sm text-muted-foreground text-center">
                  {order.reservedQuantity} × {brl(priceCents)} = <span className="text-foreground font-semibold">{brl((order.reservedQuantity ?? 0) * priceCents)}</span>
                </p>
                {order.pixQrCodeUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={order.pixQrCodeUrl} alt="QR Code PIX" className="w-52 h-52 rounded-xl bg-white p-2" />
                ) : order.pixQrCode ? (
                  <div className="p-3 bg-white rounded-xl"><QRCodeSVG value={order.pixQrCode} size={190} /></div>
                ) : null}
                {order.pixQrCode && (
                  <button onClick={() => { navigator.clipboard.writeText(order.pixQrCode!).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }); }} className="flex items-center gap-1.5 text-sm border border-border rounded-lg px-4 py-2 text-foreground hover:bg-secondary transition-colors">
                    {copied ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                    {copied ? "Copiado!" : "Copiar código PIX"}
                  </button>
                )}
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground text-center"><Clock size={13} /> Aguardando pagamento… seus números aparecem em Meus Pedidos após a confirmação.</p>
              </div>
            )}

            {/* ── SUCESSO ── */}
            {phase === "done" && (
              <div className="flex flex-col items-center gap-3 text-center pt-2">
                <CheckCircle2 size={40} className="text-green-500" />
                <p className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground">Pagamento confirmado!</p>
                <p className="text-sm text-muted-foreground">{order?.reservedQuantity} {order?.reservedQuantity === 1 ? "número reservado" : "números reservados"}. Já estão em Meus Pedidos.</p>
                <Link href="/pedidos" className="mt-1 inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90"><Ticket size={16} /> Ver meus números</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
