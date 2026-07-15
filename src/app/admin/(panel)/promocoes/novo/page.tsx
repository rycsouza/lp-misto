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
        <h2 className="font-display text-xl text-foreground tracking-wide">NOVA PROMOÇÃO</h2>
      </div>
      <PromotionForm />
    </div>
  );
}
