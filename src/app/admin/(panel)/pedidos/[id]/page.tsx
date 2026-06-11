import { getAdminOrderDetail } from "@/app/actions/admin";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { OrderActions } from "@/components/admin/OrderActions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

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
  });
}

function getItemDescription(item: {
  type: string;
  metadata: unknown;
  referenceId: string | null;
}): string {
  if (item.type === "ticket") {
    const meta = item.metadata as Record<string, unknown> | null;
    const ticketType = meta?.ticketType as string | undefined;
    return ticketType === "meia" ? "Ingresso Meia" : "Ingresso Inteira";
  }
  if (item.type === "product") {
    const meta = item.metadata as Record<string, unknown> | null;
    const name = meta?.name as string | undefined;
    const size = meta?.size as string | undefined;
    return [name ?? "Produto", size].filter(Boolean).join(" — ");
  }
  return item.type;
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-foreground tracking-wide">
            PEDIDO #{order.id.slice(0, 8).toUpperCase()}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {formatDate(order.createdAt)}
          </p>
        </div>
        <StatusBadge status={order.status} />
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
            <dd className="text-foreground mt-0.5">{order.customerEmail}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">WhatsApp</dt>
            <dd className="text-foreground mt-0.5">
              {order.customerWhatsapp}
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider py-2">
                Tipo
              </th>
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
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-border/50">
                <td className="py-3 text-muted-foreground capitalize text-xs">
                  {item.type}
                </td>
                <td className="py-3 text-foreground">
                  {getItemDescription(item)}
                </td>
                <td className="py-3 text-right text-foreground">
                  {item.quantity}
                </td>
                <td className="py-3 text-right text-foreground">
                  {formatCurrency(item.unitPriceCents)}
                </td>
                <td className="py-3 text-right font-medium text-foreground">
                  {formatCurrency(item.quantity * item.unitPriceCents)}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} className="pt-3 text-right font-semibold text-foreground">
                Total
              </td>
              <td className="pt-3 text-right font-bold text-foreground text-base">
                {formatCurrency(order.totalCents)}
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
                <dd className="text-foreground mt-0.5 font-mono text-xs">
                  {order.payment.gatewayPaymentId}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Ações */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
          Ações
        </h3>
        <OrderActions orderId={order.id} currentStatus={order.status} />
      </div>
    </div>
  );
}
