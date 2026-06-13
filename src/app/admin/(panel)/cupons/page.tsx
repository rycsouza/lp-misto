import Link from "next/link";
import { Plus, Tag, Pencil } from "lucide-react";
import { getAdminCoupons } from "@/app/actions/admin-coupons";
import { deleteCoupon } from "@/app/actions/admin-coupons";
import { CopyCouponLinkButton } from "@/components/admin/CopyCouponLinkButton";

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function discountLabel(type: string, value: number) {
  return type === "pct" ? `${value}% OFF` : `${formatPrice(value)} OFF`;
}

function appliesToLabel(a: string) {
  if (a === "tickets") return "Ingressos";
  if (a === "products") return "Produtos";
  return "Pedido";
}

async function DeleteButton({ id }: { id: string }) {
  async function action() {
    "use server";
    await deleteCoupon(id);
  }
  return (
    <form action={action}>
      <button type="submit"
        className="text-xs text-destructive hover:text-destructive/80 transition-colors px-2 py-1 rounded hover:bg-destructive/10">
        Excluir
      </button>
    </form>
  );
}

export default async function CuponsPage() {
  const coupons = await getAdminCoupons();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-foreground tracking-wide">CUPONS</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{coupons.length} cupom{coupons.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/admin/cupons/novo"
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity">
          <Plus size={16} />
          Novo Cupom
        </Link>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {coupons.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum cupom cadastrado</p>
        )}
        {coupons.map((c) => (
          <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Tag size={14} className="text-primary shrink-0" />
                <span className="font-mono font-bold text-foreground tracking-widest">{c.code}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.active ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                  {c.active ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>
            {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded font-semibold">
                {discountLabel(c.discountType, c.discountValue)}
              </span>
              <span className="bg-secondary text-muted-foreground px-2 py-0.5 rounded">
                {appliesToLabel(c.appliesTo)}
              </span>
              {c.minOrderCents > 0 && (
                <span className="bg-secondary text-muted-foreground px-2 py-0.5 rounded">
                  Mín. {formatPrice(c.minOrderCents)}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
              <span>{c.usageCount} uso{c.usageCount !== 1 ? "s" : ""}{c.maxUsages ? ` / ${c.maxUsages}` : ""}</span>
              {c.expiresAt && <span>Exp. {new Date(c.expiresAt).toLocaleDateString("pt-BR")}</span>}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link href={`/admin/cupons/${c.id}`}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Pencil size={13} /> Editar
              </Link>
              <CopyCouponLinkButton code={c.code} appliesTo={c.appliesTo} />
              <DeleteButton id={c.id} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-muted-foreground font-medium">Código</th>
              <th className="px-4 py-3 text-muted-foreground font-medium">Desconto</th>
              <th className="px-4 py-3 text-muted-foreground font-medium">Aplica-se a</th>
              <th className="px-4 py-3 text-muted-foreground font-medium">Usos</th>
              <th className="px-4 py-3 text-muted-foreground font-medium">Expira</th>
              <th className="px-4 py-3 text-muted-foreground font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum cupom cadastrado</td>
              </tr>
            )}
            {coupons.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Tag size={13} className="text-primary" />
                    <span className="font-mono font-bold tracking-wider">{c.code}</span>
                  </div>
                  {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded text-xs font-semibold">
                    {discountLabel(c.discountType, c.discountValue)}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{appliesToLabel(c.appliesTo)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {c.usageCount}{c.maxUsages ? ` / ${c.maxUsages}` : ""}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.active ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                    {c.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <CopyCouponLinkButton code={c.code} appliesTo={c.appliesTo} />
                    <Link href={`/admin/cupons/${c.id}`}
                      className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil size={14} />
                    </Link>
                    <DeleteButton id={c.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
