export const dynamic = "force-dynamic";

import { getAdminCouponById, getCouponUsages } from "@/app/actions/admin-coupons";
import { CouponForm } from "@/components/admin/CouponForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function EditarCupomPage({ params }: PageProps) {
  const { id } = await params;
  const [coupon, usages] = await Promise.all([
    getAdminCouponById(id),
    getCouponUsages(id),
  ]);

  if (!coupon) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link href="/admin/cupons"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ChevronLeft size={16} />
        Voltar para cupons
      </Link>
      <h2 className="font-display text-xl text-foreground tracking-wide">EDITAR CUPOM</h2>

      <div className="bg-card border border-border rounded-xl p-6">
        <CouponForm coupon={coupon} />
      </div>

      {usages.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-foreground">Histórico de usos ({usages.length})</h3>
          <div className="flex flex-col gap-2">
            {usages.map((u) => (
              <div key={u.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-foreground text-xs font-medium">{u.customerName ?? "—"}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Pedido #{u.orderId.slice(0, 8)} — {new Date(u.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </p>
                </div>
                <span className="text-primary font-semibold text-xs">−{formatPrice(u.discountAppliedCents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
