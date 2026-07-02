import { getBarFichaPublic } from "@/app/actions/bar";
import { BarFichaView } from "@/components/bar/BarFichaView";

export default async function BarFichaPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const initial = await getBarFichaPublic(orderId);

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground text-center mb-6">
        Minha Ficha
      </h1>
      <BarFichaView orderId={orderId} initial={initial} />
    </div>
  );
}
