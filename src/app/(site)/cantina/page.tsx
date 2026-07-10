import Link from "next/link";
import { notFound } from "next/navigation";
import { CANTINA_ENABLED } from "@/lib/cantina/flag";
import { getCantinaCatalog } from "@/app/actions/cantina";
import { getCantinaConfig } from "@/lib/cantina/config";
import { CantinaOrderFlow } from "@/components/cantina/CantinaOrderFlow";

export default async function CantinaPage() {
  if (!CANTINA_ENABLED) notFound();
  const [catalog, config] = await Promise.all([getCantinaCatalog(), getCantinaConfig()]);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-primary text-sm font-semibold tracking-widest uppercase mb-1">Cantina</p>
          <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-foreground leading-none">
            Compre agora, retire no jogo
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Garanta seus itens com antecedência. No dia do jogo, é só apresentar o QR da sua carteira no
            balcão — pode retirar aos poucos, quando quiser.
          </p>
        </div>
      </div>

      <div className="mb-6">
        <Link href="/cantina/carteira" className="text-sm text-primary hover:underline">
          Já comprou? Ver minha Cantina →
        </Link>
      </div>

      <CantinaOrderFlow catalog={catalog} config={config} />
    </div>
  );
}
