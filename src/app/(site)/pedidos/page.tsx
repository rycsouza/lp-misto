"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Package, Search, QrCode, Ticket, Copy, CheckCircle2,
  Clock, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { fetchOrdersByWhatsapp } from "@/app/actions/checkout";
import { usePhoneSession } from "@/hooks/usePhoneSession";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function formatWhatsApp(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function msToCountdown(ms: number): string {
  if (ms <= 0) return "Expirado";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type OrderData = Awaited<ReturnType<typeof fetchOrdersByWhatsapp>>[number];

type ItemMeta = {
  ticketType?: string;
  name?: string;
  size?: string;
  color?: string;
  isCouponDiscount?: boolean;
  couponCode?: string;
} | null;

// ─── PIX Countdown ───────────────────────────────────────────────────────────

function PixCountdown({ expiresAt }: { expiresAt: Date | string | null }) {
  const [remaining, setRemaining] = useState(() =>
    expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0
  );

  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => {
      setRemaining(new Date(expiresAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt || remaining <= 0) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-yellow-400 font-medium">
      <Clock size={12} />
      {msToCountdown(remaining)}
    </span>
  );
}

// ─── Copy PIX button ─────────────────────────────────────────────────────────

function CopyPixButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 text-foreground hover:bg-secondary transition-colors"
    >
      {copied ? <CheckCircle2 size={13} className="text-green-500" /> : <Copy size={13} />}
      {copied ? "Copiado!" : "Copiar código PIX"}
    </button>
  );
}

// ─── Single Order Card ────────────────────────────────────────────────────────

function OrderCard({ order }: { order: OrderData }) {
  const [ticketOpen, setTicketOpen] = useState(false);
  const [pixOpen, setPixOpen] = useState(false);

  const payment = order.payment;
  const pixExpiresAt = payment?.pixExpiresAt ?? null;
  const pixExpired = pixExpiresAt ? new Date(pixExpiresAt).getTime() < Date.now() : true;
  const pixActive = order.status === "pending" && !!payment?.pixQrCode && !pixExpired;

  const hasTickets = order.items.some((i) => i.type === "ticket" && !((i.metadata as ItemMeta)?.isCouponDiscount));
  const isPaid = order.status === "paid";
  const isRefunded = order.status === "refunded";
  const isCancelled = order.status === "cancelled";
  const isPendingExpired = order.status === "pending" && pixExpired;

  // Cancelled orders with no redemption info are irrelevant — collapse them
  if (isCancelled) return null;

  const STATUS_CONFIG = {
    paid:      { label: "Pago",                 cls: "text-green-400 bg-green-400/10" },
    pending:   { label: pixActive ? "Aguardando pagamento" : "Expirado", cls: pixActive ? "text-yellow-400 bg-yellow-400/10" : "text-muted-foreground bg-muted/30" },
    refunded:  { label: "Reembolsado",          cls: "text-muted-foreground bg-muted/30" },
    cancelled: { label: "Cancelado",            cls: "text-destructive bg-destructive/10" },
  } as const;

  const st = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.cancelled;

  const cardOpacity = (isRefunded || isPendingExpired) ? "opacity-60" : "";

  return (
    <div className={`bg-card border border-border rounded-xl overflow-hidden ${cardOpacity}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-secondary/30 border-b border-border">
        <div>
          <p className="text-xs text-muted-foreground">
            Pedido <span className="font-mono font-medium text-foreground">{order.id.slice(0, 8).toUpperCase()}</span>
          </p>
          <p className="text-xs text-muted-foreground">{fmtDate(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          {pixActive && <PixCountdown expiresAt={pixExpiresAt} />}
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
        </div>
      </div>

      {/* Items */}
      <ul className="divide-y divide-border">
        {order.items.map((item) => {
          const meta = item.metadata as ItemMeta;
          const isCoupon = !!meta?.isCouponDiscount;

          if (isCoupon) {
            return (
              <li key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm bg-primary/5">
                <span className="text-primary font-semibold">Cupom {meta?.couponCode ?? ""}</span>
                <span className="text-primary font-semibold">{`−${fmtBRL(-item.unitPriceCents)}`}</span>
              </li>
            );
          }

          const isTicket = item.type === "ticket";
          const label = isTicket
            ? `Ingresso${meta?.ticketType === "meia" ? " — Meia" : meta?.ticketType === "inteira" ? " — Inteira" : ""}`
            : (meta?.name ?? "Produto");

          const variation = isTicket
            ? null
            : [meta?.color, meta?.size].filter(Boolean).join(" · ");

          return (
            <li key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div>
                <span className="text-foreground font-medium">{label}</span>
                {variation && (
                  <span className="ml-2 text-xs text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">
                    {variation}
                  </span>
                )}
                <span className="ml-2 text-xs text-muted-foreground">×{item.quantity}</span>
              </div>
              <span className="text-foreground font-semibold text-sm">
                {fmtBRL(item.quantity * item.unitPriceCents)}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Total */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="font-bold text-primary text-base">{fmtBRL(order.totalCents)}</span>
      </div>

      {/* Actions */}
      {(isPaid && hasTickets) || pixActive ? (
        <div className="border-t border-border divide-y divide-border">

          {/* Ticket QR — only for paid orders with ticket items */}
          {isPaid && hasTickets && (
            <div>
              <button
                onClick={() => setTicketOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-secondary/30 transition-colors"
              >
                <span className="flex items-center gap-2 font-medium">
                  <Ticket size={15} className="text-primary" />
                  Ver QR Code de entrada
                </span>
                {ticketOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {ticketOpen && (
                <div className="px-4 pb-5 flex flex-col items-center gap-3">
                  <p className="text-xs text-muted-foreground text-center max-w-xs">
                    Apresente este código na entrada. Um ingresso por pessoa.
                  </p>
                  <div className="p-3 bg-white rounded-xl">
                    <QRCodeSVG value={order.id} size={180} />
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">{order.id.toUpperCase()}</p>
                </div>
              )}
            </div>
          )}

          {/* PIX QR — only for pending within window */}
          {pixActive && payment?.pixQrCode && (
            <div>
              <button
                onClick={() => setPixOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-secondary/30 transition-colors"
              >
                <span className="flex items-center gap-2 font-medium">
                  <QrCode size={15} className="text-yellow-400" />
                  Pagar com PIX
                </span>
                {pixOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {pixOpen && (
                <div className="px-4 pb-5 flex flex-col items-center gap-3">
                  <p className="text-xs text-muted-foreground text-center">
                    Escaneie ou copie o código Pix Copia e Cola.
                  </p>
                  {payment.pixQrCodeUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={payment.pixQrCodeUrl}
                      alt="QR Code PIX"
                      className="w-48 h-48 rounded-xl bg-white p-1"
                    />
                  ) : (
                    <div className="p-3 bg-white rounded-xl">
                      <QRCodeSVG value={payment.pixQrCode} size={180} />
                    </div>
                  )}
                  <CopyPixButton code={payment.pixQrCode} />
                  <PixCountdown expiresAt={pixExpiresAt} />
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function PedidosContent() {
  const searchParams = useSearchParams();
  const [whatsapp, setWhatsapp] = useState("");
  const [orders, setOrders] = useState<OrderData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { phone: savedPhone, setPhone: savePhone } = usePhoneSession();
  const didAutoSearch = useRef(false);

  // Auto-search from saved phone or ?tel= param — runs once on mount
  useEffect(() => {
    if (didAutoSearch.current) return;
    const tel = searchParams.get("tel");
    const source = tel ?? savedPhone;
    if (!source) return;
    const digits = source.replace(/\D/g, "").slice(0, 11);
    if (digits.length < 10) return;
    didAutoSearch.current = true;
    setWhatsapp(formatWhatsApp(digits));
    setLoading(true);
    fetchOrdersByWhatsapp(digits).then((result) => {
      setOrders(result);
      setSearched(true);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPhone]);

  async function handleSearch() {
    const digits = whatsapp.replace(/\D/g, "");
    if (digits.length < 10) return;
    savePhone(whatsapp);
    setLoading(true);
    setSearched(false);
    const result = await fetchOrdersByWhatsapp(digits);
    setOrders(result);
    setSearched(true);
    setLoading(false);
  }

  // Sort: paid/refunded first (relevant), then pending active, then expired
  const sortedOrders = orders
    ? [...orders].sort((a, b) => {
        const priority = (o: OrderData) => {
          if (o.status === "paid") return 0;
          if (o.status === "refunded") return 1;
          const exp = o.payment?.pixExpiresAt;
          const active = exp && new Date(exp).getTime() > Date.now();
          if (o.status === "pending" && active) return 2;
          return 3;
        };
        return priority(a) - priority(b);
      })
    : null;

  const visibleOrders = sortedOrders?.filter((o) => o.status !== "cancelled") ?? null;

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          ← Voltar ao início
        </Link>

        <p className="text-primary text-xs font-semibold tracking-widest uppercase mb-1">Misto EC</p>
        <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-foreground mb-8">
          Meus Pedidos
        </h1>

        {/* Search */}
        <div className="flex gap-3 mb-8">
          <input
            type="tel"
            value={whatsapp}
            placeholder="(67) 99999-9999"
            onChange={(e) => setWhatsapp(formatWhatsApp(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 px-4 py-3 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={handleSearch}
            disabled={loading || whatsapp.replace(/\D/g, "").length < 10}
            className="px-5 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 font-semibold text-sm"
          >
            {loading
              ? <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
              : <Search size={16} />
            }
            Buscar
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
            <RefreshCw size={16} className="animate-spin" />
            Buscando pedidos...
          </div>
        )}

        {/* Empty state */}
        {!loading && searched && visibleOrders !== null && visibleOrders.length === 0 && (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">Nenhum pedido encontrado para este número.</p>
          </div>
        )}

        {/* Orders */}
        {!loading && visibleOrders && visibleOrders.length > 0 && (
          <div className="flex flex-col gap-4">
            {visibleOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function PedidosPage() {
  return (
    <Suspense fallback={null}>
      <PedidosContent />
    </Suspense>
  );
}
