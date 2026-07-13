export const dynamic = "force-dynamic";

import { getAdminUpsellOffers } from "@/app/actions/admin-growth";
import Link from "next/link";
import { Plus, Repeat2 } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";

const TRIGGER_LABELS: Record<string, string> = {
  any: "Qualquer compra",
  ticket: "Ingresso",
  product: "Produto",
  specific_product: "Produto específico",
};

const TRIGGER_COLORS: Record<string, string> = {
  any: "bg-secondary text-foreground",
  ticket: "bg-blue-500/15 text-blue-600",
  product: "bg-orange-500/15 text-orange-600",
  specific_product: "bg-purple-500/15 text-purple-600",
};

const OFFER_LABELS: Record<string, string> = {
  ticket: "Ingresso",
  product: "Produto",
};

const OFFER_COLORS: Record<string, string> = {
  ticket: "bg-green-500/15 text-green-600",
  product: "bg-yellow-500/15 text-yellow-600",
};

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function UpsellPage() {
  const offers = await getAdminUpsellOffers();

  const emptyState = (
    <EmptyState
      icon={Repeat2}
      title="Nenhuma oferta de upsell ainda"
      description="Ofereça um item extra com desconto na hora do pagamento."
      action={{ label: "Nova oferta", href: "/admin/upsell/novo" }}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground tracking-wide">UPSELL</h2>
        <Link href="/admin/upsell/novo"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity">
          <Plus size={16} />Nova Oferta
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">

        {/* ── Mobile cards ─────────────────────────────────── */}
        <div className="md:hidden divide-y divide-border/50">
          {offers.length === 0 && emptyState}
          {offers.map((offer) => (
            <div key={offer.id} className="px-4 py-3 flex flex-col gap-1.5 hover:bg-secondary/20 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <p className="text-foreground font-medium text-sm">{offer.name}</p>
                <span className={offer.active
                  ? "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600"
                  : "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"}>
                  {offer.active ? "Ativo" : "Inativo"}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${TRIGGER_COLORS[offer.triggerType] ?? "bg-muted text-muted-foreground"}`}>
                  {TRIGGER_LABELS[offer.triggerType] ?? offer.triggerType}
                </span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${OFFER_COLORS[offer.offerType] ?? "bg-muted text-muted-foreground"}`}>
                  {OFFER_LABELS[offer.offerType] ?? offer.offerType}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs">
                  {offer.discountPct}% · Mín. {formatPrice(offer.minOrderCents)} · Timer {offer.timerSeconds}s
                </span>
                <Link href={`/admin/upsell/${offer.id}`} className="text-primary text-xs hover:underline font-medium">
                  Editar
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
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Nome</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Trigger</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Oferta</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Desconto</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Pedido mínimo</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Timer</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-right text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {offers.length === 0 && (
                <tr><td colSpan={8}>{emptyState}</td></tr>
              )}
              {offers.map((offer) => (
                <tr key={offer.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 text-foreground font-medium">{offer.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${TRIGGER_COLORS[offer.triggerType] ?? "bg-muted text-muted-foreground"}`}>
                      {TRIGGER_LABELS[offer.triggerType] ?? offer.triggerType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${OFFER_COLORS[offer.offerType] ?? "bg-muted text-muted-foreground"}`}>
                      {OFFER_LABELS[offer.offerType] ?? offer.offerType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{offer.discountPct}%</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatPrice(offer.minOrderCents)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{offer.timerSeconds}s</td>
                  <td className="px-4 py-3">
                    <span className={offer.active
                      ? "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600"
                      : "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"}>
                      {offer.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/upsell/${offer.id}`} className="text-primary hover:opacity-80 transition-opacity text-xs font-medium">Editar</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
