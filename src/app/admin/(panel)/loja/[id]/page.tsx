import { getAdminProductById } from "@/app/actions/admin-shop";
import { ProductForm } from "@/components/admin/ProductForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarProdutoPage({ params }: PageProps) {
  const { id } = await params;
  const product = await getAdminProductById(id);

  if (!product) notFound();

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
        EDITAR PRODUTO
      </h2>

      <div className="bg-card border border-border rounded-xl p-6">
        <ProductForm product={product} />
      </div>
    </div>
  );
}
