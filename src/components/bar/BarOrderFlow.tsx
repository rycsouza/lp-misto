"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { createBarOrder, type BarCardapioItem } from "@/app/actions/bar";
import { checkPaymentStatus } from "@/app/actions/checkout";
import { BarFichaView } from "./BarFichaView";

interface BarConfigView {
  serviceFeeType: "percent" | "fixed";
  serviceFeeValue: number;
  minOrderCents: number;
}

function brl(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function computeFee(subtotal: number, cfg: BarConfigView) {
  if (subtotal <= 0) return 0;
  return cfg.serviceFeeType === "fixed" ? cfg.serviceFeeValue : Math.round(subtotal * (cfg.serviceFeeValue / 100));
}

type Step = "menu" | "buyer" | "pay" | "ficha";

export function BarOrderFlow({
  gameId,
  gameLabel,
  cardapio,
  config,
}: {
  gameId: string;
  gameLabel: string;
  cardapio: BarCardapioItem[];
  config: BarConfigView;
}) {
  const [step, setStep] = useState<Step>("menu");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [buyer, setBuyer] = useState({ name: "", email: "", whatsapp: "" });
  const [hp, setHp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const subtotal = useMemo(
    () => cardapio.reduce((acc, it) => acc + (qty[it.offeringId] ?? 0) * it.priceCents, 0),
    [cardapio, qty]
  );
  const fee = computeFee(subtotal, config);
  const total = subtotal + fee;
  const hasItems = subtotal > 0;
  const belowMin = config.minOrderCents > 0 && subtotal > 0 && subtotal < config.minOrderCents;

  function setItemQty(id: string, next: number) {
    setQty((prev) => ({ ...prev, [id]: Math.max(0, next) }));
  }

  async function submitOrder() {
    setError(null);
    setSubmitting(true);
    const items = cardapio
      .filter((it) => (qty[it.offeringId] ?? 0) > 0)
      .map((it) => ({ offeringId: it.offeringId, quantity: qty[it.offeringId] }));
    const idempotencyKey = crypto.randomUUID();
    const res = await createBarOrder({
      gameId,
      buyer,
      items,
      paymentMethod: "pix",
      _hp: hp,
      idempotencyKey,
    });
    setSubmitting(false);
    if (!res.success || !res.orderId) {
      setError(res.error ?? "Não foi possível criar a ficha.");
      return;
    }
    setOrderId(res.orderId);
    setPaymentId(res.paymentId ?? null);
    setPixQrCode(res.pixQrCode ?? null);
    setStep("pay");
  }

  // Polling do pagamento (pausa quando a aba não está visível).
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (step !== "pay" || !paymentId) return;
    const tick = async () => {
      if (document.hidden) return;
      const status = await checkPaymentStatus(paymentId);
      if (status === "paid") {
        setStep("ficha");
      } else if (status === "failed" || status === "refunded") {
        setError("O pagamento não foi concluído. Tente novamente.");
        setStep("buyer");
      }
    };
    pollRef.current = setInterval(tick, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [step, paymentId]);

  // ── Ficha (pago) ────────────────────────────────────────────────
  if (step === "ficha" && orderId) {
    return (
      <div className="flex flex-col gap-4">
        <BarFichaView orderId={orderId} />
        <Link href={`/bar/ficha/${orderId}`} className="text-center text-sm text-primary hover:underline">
          Abrir minha ficha em uma página →
        </Link>
      </div>
    );
  }

  // ── Pagamento PIX ───────────────────────────────────────────────
  if (step === "pay") {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center gap-4 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Pague com Pix para preparar</p>
        {pixQrCode ? (
          <>
            <div className="bg-white p-3 rounded-xl">
              <QRCodeSVG value={pixQrCode} size={200} />
            </div>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(pixQrCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              }}
              className="text-sm bg-secondary text-secondary-foreground rounded-lg px-4 py-2 hover:opacity-80"
            >
              {copied ? "Copiado!" : "Copiar código Pix"}
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Gerando cobrança…</p>
        )}
        <p className="text-lg font-semibold text-foreground">{brl(total)}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Aguardando pagamento…
        </div>
      </div>
    );
  }

  // ── Dados do comprador ──────────────────────────────────────────
  if (step === "buyer") {
    const canPay = buyer.name.trim().length >= 2 && /\S+@\S+/.test(buyer.email) && buyer.whatsapp.replace(/\D/g, "").length >= 10;
    return (
      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Seus dados</p>
        <input
          type="text" placeholder="Nome completo" value={buyer.name}
          onChange={(e) => setBuyer((b) => ({ ...b, name: e.target.value }))}
          className="bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="email" placeholder="E-mail" value={buyer.email}
          onChange={(e) => setBuyer((b) => ({ ...b, email: e.target.value }))}
          className="bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="tel" placeholder="WhatsApp (com DDD)" value={buyer.whatsapp}
          onChange={(e) => setBuyer((b) => ({ ...b, whatsapp: e.target.value }))}
          className="bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        {/* honeypot anti-bot — escondido de usuários reais */}
        <input
          type="text" tabIndex={-1} autoComplete="off" value={hp}
          onChange={(e) => setHp(e.target.value)}
          className="hidden" aria-hidden="true"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold text-foreground tabular-nums">{brl(total)}</span>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => setStep("menu")} className="flex-1 bg-secondary text-secondary-foreground rounded-lg py-2.5 text-sm font-medium hover:opacity-80">
            Voltar
          </button>
          <button
            type="button" disabled={!canPay || submitting} onClick={submitOrder}
            className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Gerando Pix…" : "Pagar com Pix"}
          </button>
        </div>
      </div>
    );
  }

  // ── Cardápio (menu) ─────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{gameLabel}</p>
      {cardapio.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          O bar deste jogo ainda não tem itens disponíveis.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {cardapio.map((it) => {
            const q = qty[it.offeringId] ?? 0;
            return (
              <div key={it.offeringId} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {it.name}
                    {it.needsPrep && <span className="ml-1.5 text-[10px] text-amber-500 uppercase">preparo</span>}
                  </p>
                  {it.description && <p className="text-xs text-muted-foreground truncate">{it.description}</p>}
                  <p className="text-sm text-primary font-semibold mt-0.5">{brl(it.priceCents)}</p>
                </div>
                {it.soldOut ? (
                  <span className="text-xs text-muted-foreground border border-border rounded-full px-3 py-1">Esgotado</span>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => setItemQty(it.offeringId, q - 1)} disabled={q === 0}
                      className="w-8 h-8 rounded-lg bg-secondary text-foreground text-lg leading-none disabled:opacity-40">−</button>
                    <span className="w-6 text-center text-sm tabular-nums">{q}</span>
                    <button type="button" onClick={() => setItemQty(it.offeringId, q + 1)}
                      className="w-8 h-8 rounded-lg bg-primary text-primary-foreground text-lg leading-none">+</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasItems && (
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 text-sm sticky bottom-4">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{brl(subtotal)}</span></div>
          {fee > 0 && <div className="flex justify-between text-muted-foreground"><span>Taxa de serviço</span><span className="tabular-nums">{brl(fee)}</span></div>}
          <div className="flex justify-between font-semibold text-foreground"><span>Total</span><span className="tabular-nums">{brl(total)}</span></div>
          {belowMin && (
            <p className="text-xs text-amber-500 mt-1">
              Pedido mínimo de {brl(config.minOrderCents)} — adicione mais itens.
            </p>
          )}
          <button
            type="button" disabled={belowMin} onClick={() => { setError(null); setStep("buyer"); }}
            className="mt-2 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            Continuar
          </button>
        </div>
      )}
    </div>
  );
}
