"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { createCantinaOrder, type CantinaCatalogItem } from "@/app/actions/cantina";
import { checkPaymentStatus } from "@/app/actions/checkout";
import { validateCPF, formatCPF } from "@/lib/cpf";

interface CantinaConfigView {
  serviceFeeType: "percent" | "fixed";
  serviceFeeValue: number;
  minOrderCents: number;
}

function brl(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function computeFee(subtotal: number, cfg: CantinaConfigView) {
  if (subtotal <= 0) return 0;
  return cfg.serviceFeeType === "fixed" ? cfg.serviceFeeValue : Math.round(subtotal * (cfg.serviceFeeValue / 100));
}

// Ordem e rótulos das categorias no cardápio.
const CAT_ORDER = ["comida", "bebida", "outro"] as const;
const CAT_LABEL: Record<string, string> = { comida: "Comida", bebida: "Bebidas", outro: "Outros" };
const CAT_EMOJI: Record<string, string> = { comida: "🍔", bebida: "🥤", outro: "✨" };

type Step = "menu" | "buyer" | "pay" | "done";

export function CantinaOrderFlow({
  catalog,
  config,
}: {
  catalog: CantinaCatalogItem[];
  config: CantinaConfigView;
}) {
  const [step, setStep] = useState<Step>("menu");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [buyer, setBuyer] = useState({ name: "", email: "", whatsapp: "" });
  const [cpf, setCpf] = useState("");
  const [hp, setHp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const subtotal = useMemo(
    () => catalog.reduce((acc, it) => acc + (qty[it.itemId] ?? 0) * it.priceCents, 0),
    [catalog, qty]
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
    const items = catalog
      .filter((it) => (qty[it.itemId] ?? 0) > 0)
      .map((it) => ({ itemId: it.itemId, quantity: qty[it.itemId] }));
    const idempotencyKey = crypto.randomUUID();
    const res = await createCantinaOrder({
      buyer,
      items,
      paymentMethod: "pix",
      customerCpf: cpf.replace(/\D/g, ""),
      _hp: hp,
      idempotencyKey,
    });
    setSubmitting(false);
    if (!res.success || !res.orderId) {
      setError(res.error ?? "Não foi possível concluir a compra.");
      return;
    }
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
        setStep("done");
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

  const walletHref = `/cantina/carteira?tel=${encodeURIComponent(buyer.whatsapp.replace(/\D/g, ""))}`;

  // ── Sucesso ─────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center text-3xl">🎉</div>
        <h2 className="text-xl font-semibold text-foreground">Compra concluída!</h2>
        <p className="text-sm text-muted-foreground">
          Seus vales já estão na sua Cantina. É só apresentar o QR da carteira no balcão, em qualquer
          jogo em casa — pode retirar aos poucos, quando quiser.
        </p>
        <Link
          href={walletHref}
          className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90"
        >
          Abrir minha Cantina →
        </Link>
      </div>
    );
  }

  // ── Pagamento PIX ───────────────────────────────────────────────
  if (step === "pay") {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center gap-4 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Pague com Pix para garantir seus vales</p>
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
    const cpfValid = validateCPF(cpf);
    const canPay =
      buyer.name.trim().length >= 2 &&
      /\S+@\S+/.test(buyer.email) &&
      buyer.whatsapp.replace(/\D/g, "").length >= 10 &&
      cpfValid;
    const cpfDigits = cpf.replace(/\D/g, "");
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
        <div>
          <input
            type="text" inputMode="numeric" placeholder="CPF do pagador" value={cpf}
            onChange={(e) => setCpf(formatCPF(e.target.value))}
            className={`w-full bg-input border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring ${cpfDigits.length === 11 && !cpfValid ? "border-destructive" : "border-border"}`}
          />
          {cpfDigits.length === 11 && !cpfValid && (
            <p className="text-xs text-destructive mt-1">CPF inválido</p>
          )}
        </div>
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

  // ── Catálogo (cardápio) ─────────────────────────────────────────
  const grouped = CAT_ORDER
    .map((cat) => ({ cat, items: catalog.filter((i) => i.category === cat) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-5">
      {catalog.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          A Cantina ainda não tem itens à venda. Volte em breve!
        </div>
      ) : (
        <>
          {/* Atalhos de categoria */}
          {grouped.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {grouped.map((g) => (
                <button
                  key={g.cat}
                  type="button"
                  onClick={() => document.getElementById(`cat-${g.cat}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  {CAT_EMOJI[g.cat]} {CAT_LABEL[g.cat]}
                </button>
              ))}
            </div>
          )}

          {grouped.map((g) => (
            <section key={g.cat} id={`cat-${g.cat}`} className="flex flex-col gap-2 scroll-mt-4">
              <h2 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground flex items-center gap-2">
                <span aria-hidden>{CAT_EMOJI[g.cat]}</span> {CAT_LABEL[g.cat]}
              </h2>
              {g.items.map((it) => {
                const q = qty[it.itemId] ?? 0;
                return (
                  <div
                    key={it.itemId}
                    className={`flex gap-3 bg-card border border-border rounded-2xl p-3 ${it.soldOut ? "opacity-60" : ""}`}
                  >
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-secondary/40 shrink-0 flex items-center justify-center">
                      {it.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.imageUrl} alt={it.name} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl opacity-50" aria-hidden>{CAT_EMOJI[it.category] ?? "✨"}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <p className="text-sm font-semibold text-foreground">
                        {it.name}
                        {it.needsPrep && <span className="ml-1.5 text-[10px] text-amber-500 uppercase align-middle">preparo</span>}
                      </p>
                      {it.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{it.description}</p>}
                      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                        <span className="text-sm text-primary font-semibold tabular-nums">{brl(it.priceCents)}</span>
                        {it.soldOut ? (
                          <span className="text-xs text-muted-foreground border border-border rounded-full px-3 py-1">Esgotado</span>
                        ) : (
                          <div className="flex items-center gap-2 shrink-0">
                            <button type="button" onClick={() => setItemQty(it.itemId, q - 1)} disabled={q === 0}
                              className="w-8 h-8 rounded-lg bg-secondary text-foreground text-lg leading-none disabled:opacity-40">−</button>
                            <span className="w-6 text-center text-sm tabular-nums">{q}</span>
                            <button type="button" onClick={() => setItemQty(it.itemId, q + 1)}
                              className="w-8 h-8 rounded-lg bg-primary text-primary-foreground text-lg leading-none">+</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </>
      )}

      {hasItems && (
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 text-sm sticky bottom-4">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{brl(subtotal)}</span></div>
          {fee > 0 && <div className="flex justify-between text-muted-foreground"><span>Taxa de serviço</span><span className="tabular-nums">{brl(fee)}</span></div>}
          <div className="flex justify-between font-semibold text-foreground"><span>Total</span><span className="tabular-nums">{brl(total)}</span></div>
          {belowMin && (
            <p className="text-xs text-amber-500 mt-1">
              Compra mínima de {brl(config.minOrderCents)} — adicione mais itens.
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
