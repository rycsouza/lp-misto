import { StatusBadge } from "./StatusBadge";
import Link from "next/link";

interface OrderRow {
  id: string;
  customerName: string;
  customerWhatsapp: string;
  totalCents: number;
  gatewaySlug: string | null;
  displayStatus: string;
  createdAt: Date;
}

interface Props {
  rows: OrderRow[];
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function toWaLink(raw: string) {
  const d = raw.replace(/\D/g, "");
  return `https://wa.me/${d.startsWith("55") ? d : `55${d}`}`;
}

export function BulkOrdersTable({ rows }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">

      {/* ── Mobile cards ─────────────────────────────────── */}
      <div className="md:hidden divide-y divide-border/50">
        {rows.length === 0 && (
          <p className="text-center text-muted-foreground py-10 text-sm">
            Nenhum pedido encontrado
          </p>
        )}
        {rows.map((order) => (
          <div key={order.id} className="px-4 py-3 flex flex-col gap-1.5 hover:bg-secondary/20 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <span className="text-foreground font-medium text-sm">{order.customerName}</span>
              <StatusBadge status={order.displayStatus} />
            </div>
            <div className="flex items-center justify-between">
              <a
                href={toWaLink(order.customerWhatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground text-xs hover:text-green-500 transition-colors"
              >
                {order.customerWhatsapp}
              </a>
              <span className="font-semibold text-foreground text-sm">
                {formatCurrency(order.totalCents)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">
                {order.gatewaySlug?.toUpperCase() ?? "—"} · {formatDate(order.createdAt)}
              </span>
              <Link href={`/admin/pedidos/${order.id}`} className="text-primary text-xs hover:underline">
                Ver
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* ── Desktop table ─────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">ID</th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Nome</th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">WhatsApp</th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Total</th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Método</th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Data</th>
              <th className="text-right text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted-foreground py-10">
                  Nenhum pedido encontrado
                </td>
              </tr>
            )}
            {rows.map((order) => (
              <tr key={order.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                  {order.id.slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-foreground">{order.customerName}</td>
                <td className="px-4 py-3">
                  <a
                    href={toWaLink(order.customerWhatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-green-500 transition-colors"
                  >
                    {order.customerWhatsapp}
                  </a>
                </td>
                <td className="px-4 py-3 font-medium text-foreground">
                  {formatCurrency(order.totalCents)}
                </td>
                <td className="px-4 py-3 text-muted-foreground uppercase text-xs">
                  {order.gatewaySlug ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.displayStatus} />
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {formatDate(order.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/pedidos/${order.id}`} className="text-primary text-xs hover:underline">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
