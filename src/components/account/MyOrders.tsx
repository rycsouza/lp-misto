"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Package } from "lucide-react";
import { getMyOrders } from "@/app/actions/account";
import { OrderCard, TABS, matchesTab, type OrderData, type TabKey } from "@/components/orders/OrderCards";

/** Pedidos do e-mail confirmado da conta — com os QR dos ingressos. */
export function MyOrders() {
  const [orders, setOrders] = useState<OrderData[] | null>(null);
  const [tab, setTab] = useState<TabKey>("todos");

  useEffect(() => {
    getMyOrders()
      .then((r) => setOrders((r.ok ? r.orders : []) as unknown as OrderData[]))
      .catch(() => setOrders([]));
  }, []);

  if (!orders) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        <Package className="mx-auto mb-3 opacity-40" size={32} />
        <p>Nenhum pedido com o e-mail desta conta.</p>
        <p className="text-xs mt-1">
          Comprou com outro e-mail? Use <Link href="/pedidos" className="underline">Meus Pedidos</Link>.
        </p>
      </div>
    );
  }

  const visible = orders.filter((o) => matchesTab(o, tab));
  const siteName = (orders[0] as { siteName?: string | null }).siteName ?? null;
  return (
    <div>
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap ${
              tab === t.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        {visible.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nada por aqui.</p>}
        {visible.map((o) => (
          <OrderCard key={o.id} order={o} siteName={siteName} />
        ))}
      </div>
    </div>
  );
}
