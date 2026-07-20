"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Minus, Plus, Loader2, Copy, CheckCircle2, Clock, Ticket } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { createRaffleOrder, checkPaymentStatus } from "@/app/actions/checkout";

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

type Phase = "select" | "buyer" | "pix" | "done";

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
  const [phase, setPhase] = useState<Phase>("select");
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cpf, setCpf] = useState("");
  const [hp, setHp] = useState(""); // honeypot
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

  // Polling do pagamento na fase PIX.
  useEffect(() => {
    if (phase !== "pix" || !order?.paymentId) return;
    const id = setInterval(async () => {
      const st = await checkPaymentStatus(order.paymentId);
      if (st === "paid") {
        clearInterval(id);
        setPhase("done");
      } else if (st === "failed") {
        clearInterval(id);
        setError("O PIX expirou ou falhou. Tente novamente.");
        setPhase("select");
      }
    }, 12000);
    return () => clearInterval(id);
  }, [phase, order?.paymentId]);

  if (status !== "active" || availableCount === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 text-center">
        <p className="text-sm text-muted-foreground">
          {status === "drawn"
            ? "Este sorteio já foi realizado."
            : status === "closed"
            ? "As vendas deste sorteio foram encerradas."
            : "Números esgotados."}
        </p>
      </div>
    );
  }

  async function submit() {
    setError(null);
    if (!name.trim() || !email.trim() || whatsapp.replace(/\D/g, "").length < 10) {
      setError("Preencha nome, e-mail e WhatsApp.");
      return;
    }
    if (!idemRef.current) idemRef.current = crypto.randomUUID();
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
    if (!r.success) {
      setError(r.error ?? "Não foi possível processar.");
      return;
    }
    setOrder({
      paymentId: r.paymentId!,
      pixQrCode: r.pixQrCode,
      pixQrCodeUrl: r.pixQrCodeUrl,
      reservedQuantity: r.reservedQuantity,
      requestedQuantity: r.requestedQuantity,
    });
    setPhase("pix");
  }

  // ── Sucesso ──
  if (phase === "done") {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center flex flex-col items-center gap-3">
        <CheckCircle2 size={40} className="text-green-500" />
        <p className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground">Pagamento confirmado!</p>
        <p className="text-sm text-muted-foreground">
          {order?.reservedQuantity} {order?.reservedQuantity === 1 ? "número reservado" : "números reservados"} pra você.
          Seus números já estão disponíveis em Meus Pedidos.
        </p>
        <Link
          href="/pedidos"
          className="mt-2 inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90"
        >
          <Ticket size={16} /> Ver meus números
        </Link>
      </div>
    );
  }

  // ── PIX ──
  if (phase === "pix" && order) {
    const partial =
      order.requestedQuantity != null &&
      order.reservedQuantity != null &&
      order.reservedQuantity < order.requestedQuantity;
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-4">
        <p className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground">Pague com PIX</p>
        {partial && (
          <p className="text-xs text-yellow-500 bg-yellow-500/10 rounded-lg px-3 py-2 text-center">
            Restavam só {order.reservedQuantity} números — cobramos apenas por eles.
          </p>
        )}
        <p className="text-sm text-muted-foreground text-center">
          {order.reservedQuantity} × {brl(priceCents)} ={" "}
          <span className="text-foreground font-semibold">{brl((order.reservedQuantity ?? 0) * priceCents)}</span>
        </p>
        {order.pixQrCodeUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={order.pixQrCodeUrl} alt="QR Code PIX" className="w-52 h-52 rounded-xl bg-white p-2" />
        ) : order.pixQrCode ? (
          <div className="p-3 bg-white rounded-xl">
            <QRCodeSVG value={order.pixQrCode} size={190} />
          </div>
        ) : null}
        {order.pixQrCode && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(order.pixQrCode!).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              });
            }}
            className="flex items-center gap-1.5 text-sm border border-border rounded-lg px-4 py-2 text-foreground hover:bg-secondary transition-colors"
          >
            {copied ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
            {copied ? "Copiado!" : "Copiar código PIX"}
          </button>
        )}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock size={13} /> Aguardando pagamento… seus números aparecem em Meus Pedidos após a confirmação.
        </p>
      </div>
    );
  }

  // ── Seleção + dados ──
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Quantos números?</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-secondary disabled:opacity-40"
            disabled={qty <= 1}
            aria-label="Menos"
          >
            <Minus size={16} />
          </button>
          <span className="w-10 text-center font-semibold text-lg tabular-nums">{qty}</span>
          <button
            onClick={() => setQty((q) => Math.min(cap, q + 1))}
            className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-secondary disabled:opacity-40"
            disabled={qty >= cap}
            aria-label="Mais"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="font-bold text-primary text-lg">{brl(qty * priceCents)}</span>
      </div>

      {phase === "buyer" && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" />
          <input className={inputClass} type="tel" value={whatsapp} onChange={(e) => setWhatsapp(fmtWhats(e.target.value))} placeholder="WhatsApp (67) 99999-9999" />
          <input className={inputClass} value={cpf} onChange={(e) => setCpf(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="CPF (se solicitado no pagamento)" inputMode="numeric" />
          {/* honeypot */}
          <input type="text" value={hp} onChange={(e) => setHp(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        </div>
      )}

      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

      <button
        onClick={() => (phase === "select" ? setPhase("buyer") : submit())}
        disabled={loading}
        className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        {phase === "select" ? "Participar" : "Gerar PIX"}
      </button>
    </div>
  );
}
