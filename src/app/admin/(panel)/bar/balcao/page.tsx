import { BarBalcao } from "@/components/bar/BarBalcao";

export default function BarBalcaoPage() {
  return (
    <div className="p-4 sm:p-6">
      <p className="text-sm text-muted-foreground mb-4 text-center max-w-md mx-auto">
        Bipe o QR da ficha (ou digite o código) e entregue os itens. Só fichas <b>pagas e prontas</b> podem ser entregues.
      </p>
      <BarBalcao />
    </div>
  );
}
