export const dynamic = "force-dynamic";

import Link from "next/link";
import { Plus, Pencil, Zap } from "lucide-react";
import { getAdminPromotions, deletePromotion, togglePromotionActive } from "@/app/actions/admin-promotions";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";
import { EmptyState } from "@/components/admin/EmptyState";

function formatDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

function formatDiscount(type: "pct" | "fixed", value: number) {
  if (type === "pct") return `${value}%`;
  return `R$${(value / 100).toFixed(2).replace(".", ",")}`;
}

const APPLIES_TO_LABEL: Record<string, string> = {
  all: "Tudo",
  tickets: "Ingressos",
  products: "Produtos",
};

async function DeletePromoButton({ id, name }: { id: string; name: string }) {
  async function action() {
    "use server";
    await deletePromotion(id);
  }
  return <AdminDeleteButton action={action} confirmMessage={`Excluir "${name}"?`} />;
}

async function TogglePromoButton({ id, active }: { id: string; active: boolean }) {
  async function action() {
    "use server";
    await togglePromotionActive(id, !active);
  }
  return (
    <form action={action}>
      <button type="submit" className={`text-xs px-2 py-1 rounded transition-colors ${active ? "text-yellow-600 hover:bg-yellow-500/10" : "text-green-600 hover:bg-green-500/10"}`}>
        {active ? "Pausar" : "Ativar"}
      </button>
    </form>
  );
}

export default async function PromocoesAdminPage() {
  const promotions = await getAdminPromotions();
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground">
            Promoções
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Descontos automáticos aplicados no checkout sem código.
          </p>
        </div>
        <Link
          href="/admin/promocoes/novo"
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> Nova Promoção
        </Link>
      </div>

      {promotions.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Nenhuma promoção ainda"
          description="Crie promoções por período para impulsionar as vendas."
          action={{ label: "Nova promoção", href: "/admin/promocoes/novo" }}
        />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-muted-foreground font-medium">Nome</th>
                <th className="px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Desconto</th>
                <th className="px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Aplica a</th>
                <th className="px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Período</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="px-4 py-3 text-muted-foreground font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((promo) => {
                const isActive = promo.active && promo.startsAt <= now && promo.endsAt >= now;
                const isExpired = promo.endsAt < now;
                return (
                  <tr key={promo.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {promo.flashSale && <Zap size={14} className="text-red-500 shrink-0" fill="currentColor" />}
                        <span className="font-medium text-foreground">{promo.name}</span>
                      </div>
                      {promo.description && (
                        <p className="text-muted-foreground text-xs mt-0.5">{promo.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-foreground font-semibold">
                      {formatDiscount(promo.discountType, promo.discountValue)}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {APPLIES_TO_LABEL[promo.appliesTo]}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                      {formatDate(promo.startsAt)} → {formatDate(promo.endsAt)}
                    </td>
                    <td className="px-4 py-3">
                      {isExpired ? (
                        <span className="text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">Expirada</span>
                      ) : isActive ? (
                        <span className="text-xs text-green-500 bg-green-500/10 rounded-full px-2 py-0.5">Ativa</span>
                      ) : (
                        <span className="text-xs text-yellow-500 bg-yellow-500/10 rounded-full px-2 py-0.5">
                          {promo.active ? "Agendada" : "Inativa"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <TogglePromoButton id={promo.id} active={promo.active} />
                        <Link
                          href={`/admin/promocoes/${promo.id}`}
                          className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Pencil size={15} />
                        </Link>
                        <DeletePromoButton id={promo.id} name={promo.name} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
