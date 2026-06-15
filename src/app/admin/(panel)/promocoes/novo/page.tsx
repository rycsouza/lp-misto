import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PromotionForm } from "@/components/admin/PromotionForm";

export default function NovaPromocaoPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/promocoes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft size={14} /> Promoções
        </Link>
        <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground">
          Nova Promoção
        </h1>
      </div>
      <PromotionForm />
    </div>
  );
}
