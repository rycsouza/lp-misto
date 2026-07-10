"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { ShoppingBag, Plus, Minus, X } from "lucide-react";
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

  // Cardápio: categoria ativa (scroll-spy) + item aberto no bottom-sheet.
  const [activeCat, setActiveCat] = useState<string>("");
  const [detail, setDetail] = useState<CantinaCatalogItem | null>(null);
  const [sheetQty, setSheetQty] = useState(1);

  const subtotal = useMemo(
    () => catalog.reduce((acc, it) => acc + (qty[it.itemId] ?? 0) * it.priceCents, 0),
    [catalog, qty]
  );
  const itemCount = useMemo(() => Object.values(qty).reduce((a, n) => a + n, 0), [qty]);
  const fee = computeFee(subtotal, config);
  const total = subtotal + fee;
  const hasItems = subtotal > 0;
  const belowMin = config.minOrderCents > 0 && subtotal > 0 && subtotal < config.minOrderCents;

  // Scroll-spy: destaca a categoria cuja seção está no topo da área visível.
  useEffect(() => {
    if (step !== "menu") return;
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-cat-section]"));
    if (sections.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const cat = visible[0]?.target.getAttribute("data-cat");
        if (cat) setActiveCat(cat);
      },
      { rootMargin: "-120px 0px -70% 0px", threshold: 0 }
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [step, catalog]);

  // Trava o scroll do body enquanto o bottom-sheet está aberto.
  useEffect(() => {
    if (!detail) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [detail]);

  function openDetail(it: CantinaCatalogItem) {
    if (it.soldOut) return;
    setSheetQty(Math.max(1, qty[it.itemId] ?? 0));
    setDetail(it);
  }
  function addFromSheet() {
    if (!detail) return;
    setItemQty(detail.itemId, sheetQty);
    setDetail(null);
  }

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

  if (catalog.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
        A Cantina ainda não tem itens à venda. Volte em breve! 👀
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-28">
      {/* Barra de categorias fixa (gruda abaixo do header do site) */}
      {grouped.length > 1 && (
        <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 bg-background/90 backdrop-blur-md border-b border-border">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {grouped.map((g) => {
              const on = activeCat === g.cat;
              return (
                <button
                  key={g.cat}
                  type="button"
                  onClick={() => document.getElementById(`cat-${g.cat}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className={`shrink-0 whitespace-nowrap px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    on ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {CAT_LABEL[g.cat]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {grouped.map((g) => (
        <section
          key={g.cat}
          id={`cat-${g.cat}`}
          data-cat-section
          data-cat={g.cat}
          className="scroll-mt-28 pt-6 first:pt-4 flex flex-col gap-2"
        >
          <h2 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground flex items-center gap-2 mb-1">
            <span aria-hidden>{CAT_EMOJI[g.cat]}</span> {CAT_LABEL[g.cat]}
          </h2>
          {g.items.map((it) => {
            const q = qty[it.itemId] ?? 0;
            return (
              <div
                key={it.itemId}
                onClick={() => openDetail(it)}
                className={`group flex gap-3 rounded-2xl border border-border bg-card p-3 transition-colors ${
                  it.soldOut ? "opacity-60" : "cursor-pointer hover:border-primary/40"
                }`}
              >
                <div className="flex-1 min-w-0 flex flex-col">
                  <p className="text-sm font-semibold text-foreground">
                    {it.name}
                    {it.needsPrep && <span className="ml-1.5 text-[10px] text-amber-500 uppercase align-middle">preparo</span>}
                  </p>
                  {it.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{it.description}</p>}
                  <span className="mt-auto pt-2 text-sm text-primary font-semibold tabular-nums">{brl(it.priceCents)}</span>
                </div>

                {/* Imagem + controle de quantidade */}
                <div className="relative shrink-0">
                  <div className="w-24 h-24 rounded-xl overflow-hidden bg-secondary/40 flex items-center justify-center">
                    {it.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.imageUrl} alt={it.name} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl opacity-50" aria-hidden>{CAT_EMOJI[it.category] ?? "✨"}</span>
                    )}
                  </div>

                  {it.soldOut ? (
                    <span className="absolute inset-x-0 bottom-1 mx-auto w-max px-2 py-0.5 rounded-full bg-background/90 text-[10px] text-muted-foreground">
                      Esgotado
                    </span>
                  ) : q > 0 ? (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute -bottom-2 right-1 flex items-center gap-1 bg-background border border-border rounded-full shadow-lg px-1 py-0.5"
                    >
                      <button type="button" aria-label="Diminuir" onClick={() => setItemQty(it.itemId, q - 1)}
                        className="w-6 h-6 rounded-full bg-secondary text-foreground flex items-center justify-center"><Minus size={13} /></button>
                      <span className="w-4 text-center text-xs font-semibold tabular-nums">{q}</span>
                      <button type="button" aria-label="Aumentar" onClick={() => setItemQty(it.itemId, q + 1)}
                        className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Plus size={13} /></button>
                    </div>
                  ) : (
                    <button
                      type="button" aria-label="Adicionar"
                      onClick={(e) => { e.stopPropagation(); setItemQty(it.itemId, 1); }}
                      className="absolute -bottom-2 right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:opacity-90"
                    >
                      <Plus size={17} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ))}

      {/* Barra de carrinho flutuante */}
      {hasItems && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 pointer-events-none">
          <div className="pointer-events-auto max-w-2xl mx-auto">
            <button
              type="button"
              disabled={belowMin}
              onClick={() => { setError(null); setStep("buyer"); }}
              className="w-full flex items-center gap-3 bg-primary text-primary-foreground rounded-2xl px-4 py-3.5 shadow-2xl hover:opacity-95 disabled:opacity-60 transition-opacity"
            >
              <span className="relative flex items-center justify-center">
                <ShoppingBag size={22} />
                <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-background text-primary text-[11px] font-bold flex items-center justify-center tabular-nums">
                  {itemCount}
                </span>
              </span>
              <span className="flex-1 text-left text-sm font-semibold">
                {belowMin ? `Faltam ${brl(config.minOrderCents - subtotal)} p/ o mínimo` : "Continuar"}
              </span>
              <span className="font-bold tabular-nums">{brl(total)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom-sheet de detalhe do item */}
      {detail && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-card border-t sm:border border-border rounded-t-3xl sm:rounded-2xl">
            <div className="relative aspect-[4/3] bg-secondary/40 flex items-center justify-center">
              {detail.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.imageUrl} alt={detail.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-6xl opacity-50" aria-hidden>{CAT_EMOJI[detail.category] ?? "✨"}</span>
              )}
              <button
                type="button" aria-label="Fechar" onClick={() => setDetail(null)}
                className="absolute top-3 left-3 w-9 h-9 rounded-full bg-background/80 backdrop-blur text-foreground flex items-center justify-center hover:bg-background"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-2">
              <h3 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground leading-tight">
                {detail.name}
                {detail.needsPrep && <span className="ml-2 text-[10px] text-amber-500 uppercase align-middle">preparo</span>}
              </h3>
              {detail.description && <p className="text-sm text-muted-foreground leading-relaxed">{detail.description}</p>}
            </div>
            <div className="sticky bottom-0 bg-card border-t border-border p-4 flex items-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" aria-label="Diminuir" onClick={() => setSheetQty((n) => Math.max(1, n - 1))}
                  className="w-9 h-9 rounded-full bg-secondary text-foreground flex items-center justify-center"><Minus size={16} /></button>
                <span className="w-6 text-center text-sm font-semibold tabular-nums">{sheetQty}</span>
                <button type="button" aria-label="Aumentar" onClick={() => setSheetQty((n) => n + 1)}
                  className="w-9 h-9 rounded-full bg-secondary text-foreground flex items-center justify-center"><Plus size={16} /></button>
              </div>
              <button
                type="button" onClick={addFromSheet}
                className="flex-1 flex items-center justify-between gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-3 text-sm font-semibold hover:opacity-95"
              >
                <span>{qty[detail.itemId] ? "Atualizar" : "Adicionar"}</span>
                <span className="tabular-nums">{brl(detail.priceCents * sheetQty)}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
