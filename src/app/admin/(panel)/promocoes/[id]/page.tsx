export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAdminPromotion } from "@/app/actions/admin-promotions";
import { PromotionForm } from "@/components/admin/PromotionForm";

export default async function EditarPromocaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const promotion = await getAdminPromotion(id);
  if (!promotion) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/promocoes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft size={14} /> Promoções
        </Link>
        <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground">
          Editar Promoção
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{promotion.name}</p>
      </div>
      <PromotionForm promotion={promotion} />
    </div>
  );
}
