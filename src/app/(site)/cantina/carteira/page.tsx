import { CantinaWalletView } from "@/components/cantina/CantinaWalletView";

export default async function CantinaCarteiraPage({
  searchParams,
}: {
  searchParams: Promise<{ tel?: string }>;
}) {
  const { tel } = await searchParams;

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-10">
      <p className="text-primary text-sm font-semibold tracking-widest uppercase mb-1">Minha Cantina</p>
      <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-foreground leading-none mb-6">
        Meus vales
      </h1>
      <CantinaWalletView initialTel={tel ?? ""} />
    </div>
  );
}
