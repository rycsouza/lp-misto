export const dynamic = "force-dynamic";

import { CantinaBalcao } from "@/components/cantina/CantinaBalcao";

export default function CantinaBalcaoPage() {
  return (
    <div className="p-4 sm:p-6">
      <p className="text-sm text-muted-foreground mb-4 text-center max-w-md mx-auto">
        Bipe o QR da carteira do torcedor (ou digite o código), escolha as quantidades e confirme a
        retirada. O saldo do vale é baixado na hora.
      </p>
      <CantinaBalcao />
    </div>
  );
}
