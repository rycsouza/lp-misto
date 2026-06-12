import { UpsellOfferForm } from "@/components/admin/UpsellOfferForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function NovaOfertaUpsellPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link
        href="/admin/upsell"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft size={16} />
        Voltar para upsell
      </Link>

      <h2 className="font-display text-xl text-foreground tracking-wide">
        NOVA OFERTA DE UPSELL
      </h2>

      <div className="bg-card border border-border rounded-xl p-6">
        <UpsellOfferForm />
      </div>
    </div>
  );
}
