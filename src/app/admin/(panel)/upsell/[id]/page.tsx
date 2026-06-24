export const dynamic = "force-dynamic";

import { getAdminUpsellOfferById, getProductsForUpsellForm } from "@/app/actions/admin-growth";
import { UpsellOfferForm } from "@/components/admin/UpsellOfferForm";
import { getSiteConfig } from "@/lib/config";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarOfertaUpsellPage({ params }: PageProps) {
  const { id } = await params;
  const [offer, products, config] = await Promise.all([
    getAdminUpsellOfferById(id),
    getProductsForUpsellForm(),
    getSiteConfig(),
  ]);

  if (!offer) notFound();

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
        EDITAR OFERTA DE UPSELL
      </h2>

      <div className="bg-card border border-border rounded-xl p-6">
        <UpsellOfferForm
          offer={offer}
          products={products}
          ticketPrices={{
            inteiraPrice: config.ticketPriceInteiraCents,
            meiaPrice: config.ticketPriceMeiaCents,
          }}
        />
      </div>
    </div>
  );
}
