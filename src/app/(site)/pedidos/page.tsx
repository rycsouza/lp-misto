"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Package, Search, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { fetchOrdersByWhatsapp } from "@/app/actions/checkout";
import { usePhoneSession } from "@/hooks/usePhoneSession";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatWhatsApp(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: "Aguardando pagamento", color: "text-yellow-400" },
  paid:      { label: "Pago",                 color: "text-green-400" },
  cancelled: { label: "Cancelado",            color: "text-destructive" },
  refunded:  { label: "Reembolsado",          color: "text-muted-foreground" },
};

type OrderWithItems = Awaited<ReturnType<typeof fetchOrdersByWhatsapp>>[number];

function PedidosContent() {
  const searchParams = useSearchParams();
  const [whatsapp, setWhatsapp] = useState("");
  const [orders, setOrders] = useState<OrderWithItems[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { phone: savedPhone, setPhone: savePhone } = usePhoneSession();

  // Pré-preenche via ?tel= (link de e-mail) ou telefone salvo na sessão
  useEffect(() => {
    const tel = searchParams.get("tel");
    const source = tel ?? savedPhone;
    if (!source) return;
    const digits = source.replace(/\D/g, "").slice(0, 11);
    if (digits.length < 10) return;
    const formatted = formatWhatsApp(digits);
    setWhatsapp(formatted);
    setLoading(true);
    fetchOrdersByWhatsapp(digits).then((result) => {
      setOrders(result);
      setSearched(true);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft size={16} />
          Voltar ao início
        </Link>

        <p className="text-primary text-sm font-semibold tracking-widest uppercase mb-1">Misto EC</p>
        <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-foreground mb-8">
          Meus Pedidos
        </h1>

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
            {loading ? (
              <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <Search size={16} />
            )}
            Buscar
          </button>
        </div>

        {searched && orders !== null && orders.length === 0 && (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">Nenhum pedido encontrado para este número.</p>
          </div>
        )}

        {orders && orders.length > 0 && (
          <div className="space-y-4">
            {orders.map((order) => {
              const st = STATUS_LABELS[order.status] ?? { label: order.status, color: "text-muted-foreground" };
              return (
                <div key={order.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-secondary/40 border-b border-border">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Pedido <span className="font-mono text-foreground">{order.id.slice(0, 8).toUpperCase()}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                    </div>
                    <span className={`text-xs font-semibold ${st.color}`}>{st.label}</span>
                  </div>

                  <ul className="divide-y divide-border">
                    {order.items.map((item) => {
                      const meta = item.metadata as { ticketType?: string; name?: string; size?: string; isCouponDiscount?: boolean; couponCode?: string } | null;
                      const isCoupon = !!meta?.isCouponDiscount;
                      const label = isCoupon
                        ? `Cupom ${meta?.couponCode ?? ""}`
                        : (meta?.name ?? (item.type === "ticket" ? `Ingresso${meta?.ticketType === "meia" ? " — Meia" : ""}` : "Item"));
                      return (
                        <li key={item.id} className={`flex items-center justify-between px-4 py-2.5 text-sm ${isCoupon ? "bg-primary/5" : ""}`}>
                          <div>
                            <span className={isCoupon ? "text-primary font-semibold" : "text-foreground"}>{label}</span>
                            {!isCoupon && meta?.size && <span className="ml-1.5 text-xs text-muted-foreground">({meta.size})</span>}
                            {!isCoupon && <span className="ml-2 text-xs text-muted-foreground">×{item.quantity}</span>}
                          </div>
                          <span className={`font-semibold ${isCoupon ? "text-primary" : "text-primary"}`}>
                            {isCoupon
                              ? `−${formatPrice(-item.unitPriceCents)}`
                              : formatPrice(item.quantity * item.unitPriceCents)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="text-lg font-bold text-primary">{formatPrice(order.totalCents)}</span>
                  </div>
                </div>
              );
            })}
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
