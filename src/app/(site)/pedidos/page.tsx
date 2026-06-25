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
type OrderItem = OrderData["items"][number];

type ItemMeta = {
  ticketType?: string;
  typeName?: string;
  name?: string;
  size?: string;
  color?: string;
  isCouponDiscount?: boolean;
  couponCode?: string;
} | null;

type OrderTicket = OrderData extends { tickets: infer T } ? (T extends (infer U)[] ? U : never) : never;

// ─── Game badge (cabeçalho do jogo no card) ──────────────────────────────────

type GameInfo = NonNullable<OrderItem["game"]>;

function GameBadge({ game, clubLogoUrl }: { game: GameInfo; clubLogoUrl: string | null }) {
  const gameDate = new Date(game.date).toLocaleString("pt-BR", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  return (
    <div className="w-full flex flex-col items-center gap-3 py-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{game.competition}</p>
      <div className="flex items-center gap-4">
        {/* Misto EC side */}
        <div className="flex flex-col items-center gap-1 w-20">
          {clubLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={clubLogoUrl} alt="Misto EC" className="w-12 h-12 object-contain" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center">
              <span className="text-primary font-black text-[10px] text-center leading-tight">MISTO EC</span>
            </div>
          )}
          <span className="text-xs font-semibold text-foreground text-center">Misto EC</span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-lg font-black text-muted-foreground">VS</span>
        </div>

        {/* Opponent side */}
        <div className="flex flex-col items-center gap-1 w-20">
          {game.opponentCrestUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={game.opponentCrestUrl} alt={game.opponent} className="w-12 h-12 object-contain" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-secondary border-2 border-border flex items-center justify-center">
              <span className="text-muted-foreground font-bold text-[9px] text-center leading-tight px-1">{game.opponent.slice(0, 8)}</span>
            </div>
          )}
          <span className="text-xs font-semibold text-foreground text-center leading-tight">{game.opponent}</span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <p className="text-xs text-muted-foreground">{gameDate}</p>
        <p className="text-xs text-muted-foreground">{game.venue}</p>
      </div>
    </div>
  );
}

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

// ─── Ticket QR card ────────────────────────────────────────────────────────

function TicketQR({ t, index }: { t: OrderTicket; index: number }) {
  const validated = t.status === "validated";
  return (
    <div className="flex flex-col items-center gap-2 border border-border rounded-xl p-4 bg-secondary/20 w-[200px]">
      <span className="text-xs font-semibold text-foreground text-center">
        {t.typeName} <span className="text-muted-foreground">#{index + 1}</span>
      </span>
      <div className={`p-3 bg-white rounded-xl relative ${validated ? "opacity-30" : ""}`}>
        <QRCodeSVG value={t.qrToken ?? t.id} size={150} />
      </div>
      {validated ? (
        <div className="flex flex-col items-center gap-0.5">
          <span className="flex items-center gap-1 text-xs text-green-500 font-semibold">
            <CheckCircle2 size={13} /> QR já validado
          </span>
          {t.validatedAt && (
            <span className="text-[10px] text-muted-foreground">{fmtDate(t.validatedAt)}</span>
          )}
        </div>
      ) : (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Ticket size={12} /> Válido
        </span>
      )}
    </div>
  );
}

// ─── Single Order Card ────────────────────────────────────────────────────────

function OrderCard({ order }: { order: OrderData }) {
  const clubLogoUrl = order.clubLogoUrl ?? null;
  const [ticketOpen, setTicketOpen] = useState(false);
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
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

  // Jogos identificados nos itens de ingresso (geralmente um só)
  const ticketGames = Array.from(
    new Map(
      order.items
        .filter((i) => i.type === "ticket" && i.game)
        .map((i) => [i.referenceId ?? i.game!.opponent, i.game!] as const)
    ).entries()
  );

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

      {/* Identificação do jogo — visível já na listagem */}
      {ticketGames.map(([key, g]) => (
        <div key={key} className="px-4 py-3 border-b border-border">
          <GameBadge game={g} clubLogoUrl={clubLogoUrl} />
        </div>
      ))}

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
          const ticketTypeLabel =
            meta?.typeName ??
            (meta?.ticketType === "meia" ? "Meia" : meta?.ticketType === "inteira" ? "Inteira" : null);
          const label = isTicket
            ? `Ingresso${ticketTypeLabel ? ` — ${ticketTypeLabel}` : ""}`
            : (meta?.name ?? "Produto");

          const variation = isTicket
            ? null
            : [meta?.color, meta?.size].filter(Boolean).join(" · ");

          const imageUrl = (item as typeof item & { imageUrl?: string | null }).imageUrl ?? null;

          // Ingresso pago: linha expansível com 1 QR por ingresso daquele tipo
          if (isTicket) {
            const itemTickets = order.tickets.filter(
              (t: OrderTicket) =>
                t.gameId === item.referenceId && t.typeCode === (meta?.ticketType ?? "")
            );
            const expandable = isPaid && itemTickets.length > 0;
            const open = !!openItems[item.id];
            const validatedCount = itemTickets.filter((t: OrderTicket) => t.status === "validated").length;

            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!expandable}
                  onClick={() =>
                    expandable && setOpenItems((p) => ({ ...p, [item.id]: !p[item.id] }))
                  }
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-secondary/20 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground font-medium block truncate">{label}</span>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="text-xs text-muted-foreground">×{item.quantity}</span>
                      {expandable && validatedCount > 0 && (
                        <span className="text-[10px] text-green-500 font-semibold">
                          {validatedCount}/{itemTickets.length} validado{validatedCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-foreground font-semibold text-sm shrink-0">
                    {fmtBRL(item.quantity * item.unitPriceCents)}
                  </span>
                  {expandable &&
                    (open ? (
                      <ChevronUp size={15} className="text-muted-foreground shrink-0" />
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-primary shrink-0">
                        <Ticket size={13} /> Ver QR
                        <ChevronDown size={14} />
                      </span>
                    ))}
                </button>

                {expandable && open && (
                  <div className="px-4 pb-5 pt-1 flex flex-col items-center gap-3 bg-secondary/10">
                    <p className="text-[11px] text-muted-foreground text-center max-w-xs">
                      {itemTickets.length > 1
                        ? `${itemTickets.length} ingressos — um QR por pessoa, validado individualmente.`
                        : "Apresente este QR na entrada."}
                    </p>
                    <div className="flex flex-wrap items-stretch justify-center gap-3 w-full">
                      {itemTickets.map((t: OrderTicket, i: number) => (
                        <TicketQR key={t.id} t={t} index={i} />
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 text-center leading-tight">
                      Apólice 6.063.222 · Chubb Seguros Brasil S.A.
                    </p>
                  </div>
                )}
              </li>
            );
          }

          return (
            <li key={item.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              {/* Product thumbnail */}
              <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-secondary border border-border">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt={meta?.name ?? "Produto"} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package size={18} className="text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-foreground font-medium block truncate">{label}</span>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  {variation && (
                    <span className="text-xs text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">
                      {variation}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">×{item.quantity}</span>
                </div>
              </div>
              <span className="text-foreground font-semibold text-sm shrink-0">
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
      {(isPaid && hasTickets && order.tickets.length === 0) || pixActive ? (
        <div className="border-t border-border divide-y divide-border">

          {/* Fallback: QR único do pedido quando os ingressos individuais ainda
              não foram gerados (pedidos antigos). O caso normal usa o QR por
              item, dentro de cada tipo na lista acima. */}
          {isPaid && hasTickets && order.tickets.length === 0 && (
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
                <div className="px-4 pb-5 flex flex-col items-center gap-4">
                  <div className="p-3 bg-white rounded-xl">
                    <QRCodeSVG value={order.id} size={180} />
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">{order.id.toUpperCase()}</p>
                  <p className="text-[10px] text-muted-foreground/50 text-center leading-tight">
                    Apólice 6.063.222 · Chubb Seguros Brasil S.A.
                  </p>
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

// ─── Tabs ────────────────────────────────────────────────────────────────────

type TabKey = "todos" | "aguardando" | "pagos" | "historico";

const TABS: { key: TabKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "aguardando", label: "Aguardando" },
  { key: "pagos", label: "Pagos" },
  { key: "historico", label: "Histórico" },
];

function isPixStillActive(order: OrderData) {
  const exp = order.payment?.pixExpiresAt;
  return !!exp && new Date(exp).getTime() > Date.now();
}

function matchesTab(order: OrderData, tab: TabKey): boolean {
  if (order.status === "cancelled") return false;
  switch (tab) {
    case "todos": return true;
    case "pagos": return order.status === "paid";
    case "aguardando": return order.status === "pending" && isPixStillActive(order);
    case "historico":
      return order.status === "refunded" || (order.status === "pending" && !isPixStillActive(order));
  }
}

// ─── Main content ─────────────────────────────────────────────────────────────

function PedidosContent() {
  const searchParams = useSearchParams();
  const [whatsapp, setWhatsapp] = useState("");
  const [orders, setOrders] = useState<OrderData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("todos");
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

  // Sort: paid first, then pending active, then refunded, then expired
  const sortedOrders = orders
    ? [...orders].sort((a, b) => {
        const priority = (o: OrderData) => {
          if (o.status === "paid") return 0;
          if (o.status === "pending" && isPixStillActive(o)) return 1;
          if (o.status === "refunded") return 2;
          return 3;
        };
        return priority(a) - priority(b);
      })
    : null;

  const allVisible = sortedOrders?.filter((o) => o.status !== "cancelled") ?? null;

  const tabCounts = allVisible
    ? {
        todos: allVisible.length,
        pagos: allVisible.filter((o) => matchesTab(o, "pagos")).length,
        aguardando: allVisible.filter((o) => matchesTab(o, "aguardando")).length,
        historico: allVisible.filter((o) => matchesTab(o, "historico")).length,
      }
    : null;

  const visibleOrders = allVisible?.filter((o) => matchesTab(o, activeTab)) ?? null;

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

        {/* Tabs — only after search */}
        {!loading && searched && allVisible !== null && allVisible.length > 0 && (
          <div className="flex gap-1 mb-5 bg-secondary/40 rounded-lg p-1">
            {TABS.map((tab) => {
              const count = tabCounts?.[tab.key] ?? 0;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Empty state — no orders at all */}
        {!loading && searched && allVisible !== null && allVisible.length === 0 && (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">Nenhum pedido encontrado para este número.</p>
          </div>
        )}

        {/* Empty state — tab has no results */}
        {!loading && visibleOrders !== null && visibleOrders.length === 0 && allVisible !== null && allVisible.length > 0 && (
          <div className="text-center py-10">
            <p className="text-muted-foreground text-sm">Nenhum pedido nesta categoria.</p>
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
