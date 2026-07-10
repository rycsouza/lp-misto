import Link from "next/link";
import { CantinaWalletView } from "@/components/cantina/CantinaWalletView";
import { getSiteConfig } from "@/lib/config";

export default async function CantinaCarteiraPage({
  searchParams,
}: {
  searchParams: Promise<{ tel?: string }>;
}) {
  const { tel } = await searchParams;
  const siteName = (await getSiteConfig().catch(() => null))?.siteName || null;

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <Link
          href="/cantina"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          ← Voltar à Cantina
        </Link>

        {siteName && (
          <p className="text-primary text-xs font-semibold tracking-widest uppercase mb-1">{siteName}</p>
        )}
        <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-foreground mb-8">
          Minha Cantina
        </h1>

        <CantinaWalletView initialTel={tel ?? ""} />
      </div>
    </main>
  );
}
