export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CheckCircle2, Users2 } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { getAdminAffiliate, getAffiliateReferrals, markReferralsPaid, getActiveCoupons, linkCouponToAffiliate } from "@/app/actions/admin-affiliates";
import { AffiliateForm } from "@/components/admin/AffiliateForm";
import { CouponLinkForm } from "./CouponLinkForm";

function fmtCents(cents: number) {
  return `R$${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

async function MarkPaidButton({ id }: { id: string }) {
  async function action() {
    "use server";
    await markReferralsPaid([id]);
  }
  return (
    <form action={action}>
      <button
        type="submit"
        className="flex items-center gap-1 text-xs text-green-600 hover:bg-green-500/10 px-2 py-1 rounded transition-colors"
      >
        <CheckCircle2 size={13} /> Pago
      </button>
    </form>
  );
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarAfiliadoPage({ params }: Props) {
  const { id } = await params;
  const [affiliate, referrals, activeCoupons] = await Promise.all([
    getAdminAffiliate(id),
    getAffiliateReferrals(id),
    getActiveCoupons(),
  ]);

  if (!affiliate) notFound();

  const linkedCoupon = activeCoupons.find((c) => c.affiliateId === id);

  const pendingReferrals = referrals.filter((r) => r.status === "pending");
  const pendingTotal = pendingReferrals.reduce((acc, r) => acc + r.commissionCents, 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/afiliados"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h2 className="font-display text-xl text-foreground tracking-wide">{affiliate.name.toUpperCase()}</h2>
          <code className="text-xs font-mono text-muted-foreground">{affiliate.code}</code>
        </div>
      </div>

      {/* Edit Form */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-semibold text-sm text-foreground mb-4">Dados do afiliado</h2>
        <AffiliateForm affiliate={affiliate} />
      </div>

      {/* Coupon Link */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-semibold text-sm text-foreground mb-4">Cupom vinculado</h2>
        <CouponLinkForm
          affiliateId={id}
          coupons={activeCoupons}
          currentCouponId={linkedCoupon?.id ?? null}
          linkAction={linkCouponToAffiliate}
        />
      </div>

      {/* Referrals */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm text-foreground">Indicações</h2>
            {pendingTotal > 0 && (
              <p className="text-xs text-orange-500 mt-0.5">
                {fmtCents(pendingTotal)} a pagar
              </p>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{referrals.length} total</span>
        </div>

        {referrals.length === 0 ? (
          <EmptyState
            icon={Users2}
            title="Nenhuma indicação ainda"
            description="As vendas indicadas por este afiliado aparecem aqui."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-muted-foreground font-medium">Pedido</th>
                <th className="px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Data</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Comissão</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="px-4 py-3 text-muted-foreground font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono text-muted-foreground">{r.orderId.slice(0, 8)}…</code>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs">
                    {fmtDate(r.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {fmtCents(r.commissionCents)}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "paid" ? (
                      <span className="text-xs text-green-500 bg-green-500/10 rounded-full px-2 py-0.5">Pago</span>
                    ) : r.status === "cancelled" ? (
                      <span className="text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">Cancelado</span>
                    ) : (
                      <span className="text-xs text-orange-500 bg-orange-500/10 rounded-full px-2 py-0.5">Pendente</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "pending" && <MarkPaidButton id={r.id} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
