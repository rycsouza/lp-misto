"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Package, Search, QrCode, Ticket, Copy, CheckCircle2,
  Clock, RefreshCw, ChevronDown, ChevronUp, KeyRound,
} from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { fetchOrdersByPhoneToken, requestOrdersOtp, verifyOrdersOtp } from "@/app/actions/checkout";
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

type OrderData = Awaited<ReturnType<typeof fetchOrdersByPhoneToken>>[number];
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

function GameBadge({ game, clubLogoUrl, siteName }: { game: GameInfo; clubLogoUrl: string | null; siteName: string | null }) {
  const gameDate = new Date(game.date).toLocaleString("pt-BR", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  return (
    <div className="w-full flex flex-col items-center gap-3 py-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{game.competition}</p>
      <div className="flex items-center gap-4">
        {/* Mandante side */}
        <div className="flex flex-col items-center gap-1 w-20">
          {clubLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={clubLogoUrl} alt={siteName || "Clube"} className="w-12 h-12 object-contain" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center">
              <span className="text-primary font-black text-[10px] text-center leading-tight uppercase">
                {(siteName || "Clube").slice(0, 8)}
              </span>
            </div>
          )}
          {siteName && <span className="text-xs font-semibold text-foreground text-center">{siteName}</span>}
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
        <div className="flex flex-col items-center gap-1">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Ticket size={12} /> Válido
          </span>
          {/* Código sequencial legível — o mesmo da cortesia e da validação manual */}
          <span className="text-[10px] text-muted-foreground/70">
            Código: <span className="font-mono font-semibold text-foreground tracking-wider">
              {t.serialNo != null ? String(t.serialNo) : t.id.slice(0, 8).toUpperCase()}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Pickup code block (código de retirada estilo iFood) ─────────────────────

function PickupCodeBlock({
  code,
  fulfillmentStatus,
  deliveredAt,
}: {
  code: string;
  fulfillmentStatus: string;
  deliveredAt: Date | string | null;
}) {
  const delivered = fulfillmentStatus === "delivered";
  const ready = fulfillmentStatus === "ready";

  if (delivered) {
    return (
      <div className="border-t border-border px-4 py-3 flex items-center gap-2 text-sm">
        <CheckCircle2 size={16} className="text-green-500 shrink-0" />
        <span className="text-foreground font-medium">Pedido retirado</span>
        {deliveredAt && (
          <span className="text-xs text-muted-foreground">em {fmtDate(deliveredAt)}</span>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-border px-4 py-4 flex flex-col items-center gap-2 bg-secondary/10">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <KeyRound size={13} className="text-primary" />
        Código de retirada
      </div>
      <span className="font-mono text-3xl font-bold tracking-[0.3em] text-foreground pl-[0.3em]">
        {code}
      </span>
      <p className="text-[11px] text-muted-foreground text-center max-w-xs leading-snug">
        {ready
          ? "Seu pedido está pronto! Informe este código no ponto de retirada."
          : "Informe este código no ponto de retirada para validar a entrega."}
      </p>
    </div>
  );
}

// ─── Single Order Card ────────────────────────────────────────────────────────

function OrderCard({ order, siteName }: { order: OrderData; siteName: string | null }) {
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
          <GameBadge game={g} clubLogoUrl={clubLogoUrl} siteName={siteName} />
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

      {/* Código de retirada — pedidos pagos de retirada (sem envio) */}
      {isPaid && order.pickupCode && (
        <PickupCodeBlock
          code={order.pickupCode}
          fulfillmentStatus={order.fulfillmentStatus}
          deliveredAt={order.deliveredAt}
        />
      )}

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

/** Token de acesso verificado (pós-OTP), guardado no dispositivo p/ reabrir sem novo código. */
const ACCESS_TOKEN_KEY = "orders_access_token";

function PedidosContent() {
  const searchParams = useSearchParams();
  const [whatsapp, setWhatsapp] = useState("");
  const [orders, setOrders] = useState<OrderData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("todos");
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [otpChannel, setOtpChannel] = useState<"whatsapp" | "email" | null>(null);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const { phone: savedPhone, setPhone: savePhone } = usePhoneSession();
  const didAutoSearch = useRef(false);

  // Auto-carrega SÓ via token verificado: link do WhatsApp (?t=) ou token de
  // acesso já guardado neste dispositivo (após um OTP). Número cru não carrega.
  useEffect(() => {
    if (didAutoSearch.current) return;

    if (savedPhone && !whatsapp) setWhatsapp(savedPhone); // prefill (não dispara busca)

    const urlToken = searchParams.get("t");
    let storedToken: string | null = null;
    try { storedToken = localStorage.getItem(ACCESS_TOKEN_KEY); } catch { /* ignore */ }
    const token = urlToken ?? storedToken;
    if (!token) return;

    didAutoSearch.current = true;
    setLoading(true);
    fetchOrdersByPhoneToken(token).then((result) => {
      setOrders(result);
      setSearched(true);
      setLoading(false);
      if (result.length === 0) {
        try { localStorage.removeItem(ACCESS_TOKEN_KEY); } catch { /* ignore */ }
        return;
      }
      if (urlToken) { try { localStorage.setItem(ACCESS_TOKEN_KEY, urlToken); } catch { /* ignore */ } }
      const tel = (result[0] as { customerWhatsapp?: string } | undefined)?.customerWhatsapp;
      if (tel) { const f = formatWhatsApp(tel); setWhatsapp(f); savePhone(f); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPhone]);

  async function handleRequestOtp() {
    const digits = whatsapp.replace(/\D/g, "");
    if (digits.length < 10) return;
    savePhone(whatsapp);
    setOtpError(null);
    setSending(true);
    const r = await requestOrdersOtp(digits);
    setSending(false);
    if (r.ok) {
      setOtpChannel(r.channel);
      setOtpHint(r.hint ?? null);
      setStage("otp");
      setOtpCode("");
      return;
    }
    setOtpError(
      r.error === "not_found"
        ? "Não encontramos pedidos para este número."
        : r.error === "rate_limited"
        ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
        : r.error === "invalid_phone"
        ? "Número de WhatsApp inválido."
        : "Serviço indisponível no momento. Tente novamente em instantes."
    );
  }

  async function handleVerifyOtp() {
    const digits = whatsapp.replace(/\D/g, "");
    const code = otpCode.replace(/\D/g, "");
    if (code.length < 4) return;
    setOtpError(null);
    setLoading(true);
    const r = await verifyOrdersOtp(digits, code);
    if (!r.ok) {
      setLoading(false);
      setOtpError(
        r.error === "rate_limited"
          ? "Muitas tentativas. Aguarde e tente novamente."
          : "Código incorreto ou expirado."
      );
      return;
    }
    setOrders(r.orders);
    setSearched(true);
    setStage("phone");
    setLoading(false);
    if (r.token) { try { localStorage.setItem(ACCESS_TOKEN_KEY, r.token); } catch { /* ignore */ } }
  }

  function resetAccess() {
    try { localStorage.removeItem(ACCESS_TOKEN_KEY); } catch { /* ignore */ }
    setOrders(null);
    setSearched(false);
    setStage("phone");
    setOtpError(null);
    setOtpChannel(null);
    setOtpHint(null);
    setOtpCode("");
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

  // Nome do clube vindo dos pedidos (config injetada pelo server action), quando disponível.
  // Sem nome → componentes degradam graciosamente (sem rótulo do mandante).
  const siteName =
    (orders?.map((o) => (o as { siteName?: string | null }).siteName).find((n) => n?.trim()) ?? null);

  // Já autenticado e vendo pedidos → não faz sentido mostrar o formulário de acesso.
  const viewingOrders = searched && !!allVisible && allVisible.length > 0;

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          ← Voltar ao início
        </Link>

        {siteName && (
          <p className="text-primary text-xs font-semibold tracking-widest uppercase mb-1">{siteName}</p>
        )}
        <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-foreground mb-8">
          Meus Pedidos
        </h1>

        {/* Acesso protegido (OTP). Some quando já estou vendo os pedidos. */}
        {viewingOrders ? (
          <div className="mb-6 flex justify-end">
            <button
              onClick={resetAccess}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Ver de outro número
            </button>
          </div>
        ) : stage === "phone" ? (
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="tel"
                value={whatsapp}
                placeholder="(67) 99999-9999"
                onChange={(e) => setWhatsapp(formatWhatsApp(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && handleRequestOtp()}
                className="flex-1 px-4 py-3 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={handleRequestOtp}
                disabled={sending || whatsapp.replace(/\D/g, "").length < 10}
                className="px-5 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold text-sm whitespace-nowrap"
              >
                {sending
                  ? <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                  : <Search size={16} />
                }
                Enviar código
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Enviaremos um código de acesso (por WhatsApp ou e-mail) para proteger seus ingressos.
            </p>
            {otpError && <p className="text-destructive text-xs mt-2">{otpError}</p>}
          </div>
        ) : (
          <div className="mb-8 bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound size={15} className="text-primary" />
              <p className="text-sm font-semibold text-foreground">Confirme o código</p>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {otpChannel === "email" ? (
                <>
                  Enviamos um código de 6 dígitos por e-mail para{" "}
                  <span className="text-foreground font-medium">{otpHint}</span>.
                </>
              ) : (
                <>
                  Enviamos um código de 6 dígitos no WhatsApp{" "}
                  <span className="text-foreground font-medium">{whatsapp}</span>.
                </>
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="tel"
                inputMode="numeric"
                value={otpCode}
                placeholder="000000"
                maxLength={6}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                className="flex-1 px-4 py-3 bg-input border border-border rounded-lg text-lg tracking-[0.4em] font-mono text-center focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={handleVerifyOtp}
                disabled={loading || otpCode.replace(/\D/g, "").length < 4}
                className="px-5 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold text-sm whitespace-nowrap"
              >
                {loading
                  ? <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                  : "Ver pedidos"
                }
              </button>
            </div>
            {otpError && <p className="text-destructive text-xs mt-2">{otpError}</p>}
            <div className="flex items-center gap-4 mt-3">
              <button
                onClick={() => { setStage("phone"); setOtpError(null); }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Trocar número
              </button>
              <button
                onClick={handleRequestOtp}
                disabled={sending}
                className="text-xs text-primary hover:underline disabled:opacity-40"
              >
                Reenviar código
              </button>
            </div>
          </div>
        )}

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
              <OrderCard key={order.id} order={order} siteName={siteName} />
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
