import { ProductForm } from "@/components/admin/ProductForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function NovoProdutoPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link
        href="/admin/loja"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft size={16} />
        Voltar para loja
      </Link>

      <h2 className="font-display text-xl text-foreground tracking-wide">
        NOVO PRODUTO
      </h2>

      <div className="bg-card border border-border rounded-xl p-6">
        <ProductForm />
      </div>
    </div>
  );
}
