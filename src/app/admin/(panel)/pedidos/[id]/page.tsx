import { getAdminOrderDetail } from "@/app/actions/admin";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { OrderActions } from "@/components/admin/OrderActions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Package, Ticket } from "lucide-react";
import Image from "next/image";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function toWaLink(raw: string) {
  const d = raw.replace(/\D/g, "");
  return `https://wa.me/${d.startsWith("55") ? d : `55${d}`}`;
}

function getItemDescription(item: {
  type: string;
  metadata: unknown;
  referenceId: string | null;
  game?: { opponent: string; date: Date; competition: string | null } | null;
}): string {
  const meta = item.metadata as Record<string, unknown> | null;
  if (meta?.isCouponDiscount) {
    return `Cupom ${meta.couponCode ?? ""}`;
  }
  if (meta?.isBundleDiscount) {
    return `Combo ${meta.games ?? ""} jogos (${meta.pct ?? 0}% off)`;
  }
  if (meta?.isMemberDiscount) {
    return `Desconto sócio${meta.planName ? ` — ${meta.planName}` : ""}`;
  }
  if (meta?.isPromotion) {
    return `Promoção${meta.promotionName ? ` — ${meta.promotionName}` : ""}`;
  }
  if (item.type === "ticket") {
    if (item.game) {
      return `Misto EC vs ${item.game.opponent}${item.game.competition ? ` — ${item.game.competition}` : ""}`;
    }
    const tn =
      (meta?.typeName as string) ??
      (meta?.ticketType === "meia" ? "Meia" : "Inteira");
    return `Ingresso ${tn}`;
  }
  if (item.type === "product") {
    const name = meta?.name as string | undefined;
    const size = meta?.size as string | undefined;
    const color = meta?.color as string | undefined;
    return [name ?? "Produto", color, size ? `Tam. ${size}` : undefined].filter(Boolean).join(" · ");
  }
  return item.type;
}

function ItemThumb({ item }: { item: { type: string; imageUrl: string | null; metadata: unknown } }) {
  const meta = item.metadata as Record<string, unknown> | null;
  if (
    meta?.isCouponDiscount ||
    meta?.isBundleDiscount ||
    meta?.isMemberDiscount ||
    meta?.isPromotion
  )
    return null;
  if (item.imageUrl) {
    return (
      <div className="shrink-0 w-10 h-10 rounded-md overflow-hidden border border-border bg-secondary">
        <Image src={item.imageUrl} alt="" width={40} height={40} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="shrink-0 w-10 h-10 rounded-md border border-border bg-secondary flex items-center justify-center">
      {item.type === "ticket"
        ? <Ticket size={16} className="text-muted-foreground/50" />
        : <Package size={16} className="text-muted-foreground/50" />}
    </div>
  );
}

function isCouponItem(item: { metadata: unknown }): boolean {
  const meta = item.metadata as Record<string, unknown> | null;
  return !!meta?.isCouponDiscount;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const order = await getAdminOrderDetail(id);

  if (!order) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Back link */}
      <Link
        href="/admin/pedidos"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft size={16} />
        Voltar para pedidos
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl text-foreground tracking-wide">
            PEDIDO #{order.id.slice(0, 8).toUpperCase()}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge status={order.displayStatus} />
          <OrderActions orderId={order.id} currentStatus={order.displayStatus} />
        </div>
      </div>

      {/* Cliente */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
          Cliente
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs">Nome</dt>
            <dd className="text-foreground font-medium mt-0.5">
              {order.customerName}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Email</dt>
            <dd className="mt-0.5">
              <a
                href={`mailto:${order.customerEmail}`}
                className="text-foreground hover:text-primary transition-colors"
              >
                {order.customerEmail}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">WhatsApp</dt>
            <dd className="mt-0.5">
              <a
                href={toWaLink(order.customerWhatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:text-green-500 transition-colors"
              >
                {order.customerWhatsapp}
              </a>
            </dd>
          </div>
          {order.pickupInfo && (
            <div>
              <dt className="text-muted-foreground text-xs">Retirada</dt>
              <dd className="text-foreground mt-0.5">{order.pickupInfo}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Itens */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
          Itens do Pedido
        </h3>

        {/* ── Mobile list ─────────────────────────────────── */}
        <div className="md:hidden flex flex-col divide-y divide-border/50">
          {order.items.map((item) => {
            const isCoupon = isCouponItem(item);
            const meta = item.metadata as Record<string, unknown> | null;
            const ticketType = meta?.ticketType as string | undefined;
            const ticketTypeName =
              (meta?.typeName as string) ??
              (ticketType === "meia" ? "Meia-entrada" : "Inteira");
            return (
            <div key={item.id} className={`py-3 flex items-center gap-3 ${isCoupon ? "bg-primary/5 -mx-6 px-6 rounded" : ""}`}>
              {!isCoupon && <ItemThumb item={item} />}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isCoupon ? "text-primary" : "text-foreground"}`}>
                  {getItemDescription(item)}
                </p>
                {!isCoupon && (
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {item.type === "ticket" && ticketType
                      ? `${ticketTypeName} · `
                      : ""}
                    {item.quantity}× {formatCurrency(item.unitPriceCents)}
                  </p>
                )}
              </div>
              <span className={`font-semibold text-sm shrink-0 ${isCoupon ? "text-primary" : "text-foreground"}`}>
                {isCoupon ? `−${formatCurrency(-item.unitPriceCents)}` : formatCurrency(item.quantity * item.unitPriceCents)}
              </span>
            </div>
            );
          })}
          <div className="pt-3 flex items-center justify-between">
            <span className="font-semibold text-foreground text-sm">Total</span>
            <span className="font-bold text-foreground text-base">
              {formatCurrency(order.totalCents)}
            </span>
          </div>
        </div>

        {/* ── Desktop table ─────────────────────────────────── */}
        <table className="hidden md:table w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider py-2 w-12"></th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider py-2">
                Descrição
              </th>
              <th className="text-right text-muted-foreground text-xs uppercase tracking-wider py-2">
                Qtd
              </th>
              <th className="text-right text-muted-foreground text-xs uppercase tracking-wider py-2">
                Unitário
              </th>
              <th className="text-right text-muted-foreground text-xs uppercase tracking-wider py-2">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => {
              const isCoupon = isCouponItem(item);
              const meta = item.metadata as Record<string, unknown> | null;
              const ticketType = meta?.ticketType as string | undefined;
              const ticketTypeName =
                (meta?.typeName as string) ??
                (ticketType === "meia" ? "Meia-entrada" : "Inteira");
              return (
              <tr key={item.id} className={`border-b border-border/50 ${isCoupon ? "bg-primary/5" : ""}`}>
                <td className="py-3 pr-2">
                  {!isCoupon && <ItemThumb item={item} />}
                </td>
                <td className={`py-3 font-medium ${isCoupon ? "text-primary" : "text-foreground"}`}>
                  <p>{getItemDescription(item)}</p>
                  {!isCoupon && item.type === "ticket" && item.game && (
                    <p className="text-xs text-muted-foreground font-normal mt-0.5">
                      {formatDate(item.game.date)}{ticketType ? ` · ${ticketTypeName}` : ""}
                    </p>
                  )}
                </td>
                <td className="py-3 text-right text-foreground">
                  {isCoupon ? "—" : item.quantity}
                </td>
                <td className="py-3 text-right text-foreground">
                  {isCoupon ? "—" : formatCurrency(item.unitPriceCents)}
                </td>
                <td className={`py-3 text-right font-medium ${isCoupon ? "text-primary" : "text-foreground"}`}>
                  {isCoupon ? `−${formatCurrency(-item.unitPriceCents)}` : formatCurrency(item.quantity * item.unitPriceCents)}
                </td>
              </tr>
              );
            })}
            <tr>
              <td colSpan={5} className="pt-3 text-right">
                <span className="font-semibold text-foreground mr-4">Total</span>
                <span className="font-bold text-foreground text-base">{formatCurrency(order.totalCents)}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pagamento */}
      {order.payment && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
            Pagamento
          </h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">Gateway</dt>
              <dd className="text-foreground mt-0.5 uppercase">
                {order.payment.gatewaySlug}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Status</dt>
              <dd className="mt-0.5">
                <StatusBadge status={order.payment.status} />
              </dd>
            </div>
            {order.payment.pixExpiresAt && (
              <div>
                <dt className="text-muted-foreground text-xs">
                  Expiração PIX
                </dt>
                <dd className="text-foreground mt-0.5">
                  {formatDate(order.payment.pixExpiresAt)}
                </dd>
              </div>
            )}
            {order.payment.paidAt && (
              <div>
                <dt className="text-muted-foreground text-xs">Pago em</dt>
                <dd className="text-foreground mt-0.5">
                  {formatDate(order.payment.paidAt)}
                </dd>
              </div>
            )}
            {order.payment.gatewayPaymentId && (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground text-xs">
                  ID Gateway
                </dt>
                <dd className="text-foreground mt-0.5 font-mono text-xs break-all">
                  {order.payment.gatewayPaymentId}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

    </div>
  );
}
