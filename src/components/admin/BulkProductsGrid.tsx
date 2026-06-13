import { type ProductRow } from "@/app/actions/admin-shop";
import { ProductImageCarousel } from "./ProductImageCarousel";
import { DuplicateProductButton } from "./DuplicateProductButton";
import Link from "next/link";
import { ExternalLink, Edit } from "lucide-react";

interface Props {
  rows: ProductRow[];
}

const CATEGORY_LABELS: Record<string, string> = {
  camisa_oficial: "Camisa Oficial",
  camisa_torcedor: "Camisa Torcedor",
};

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function BulkProductsGrid({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
        Nenhum produto encontrado
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {rows.map((product) => (
        <div
          key={product.id}
          className="bg-card border border-border rounded-xl overflow-hidden flex flex-col hover:border-primary/50 transition-colors"
        >
          <Link href={`/admin/loja/${product.id}`} className="p-4 flex flex-col gap-3 flex-1">
            <ProductImageCarousel
              images={[
                ...product.colorVariants
                  .map((v) => v.colorImageUrl)
                  .filter((url): url is string => !!url),
                ...(product.imageUrl &&
                product.colorVariants.every((v) => !v.colorImageUrl)
                  ? [product.imageUrl]
                  : []),
              ]}
              alt={product.name}
            />
            <div className="flex flex-col gap-1.5">
              <p className="text-foreground font-medium text-sm leading-tight">{product.name}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                  {CATEGORY_LABELS[product.category] ?? product.category}
                </span>
                <span className={product.active
                  ? "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600"
                  : "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"}>
                  {product.active ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p className="text-foreground font-semibold text-sm">{formatPrice(product.priceCents)}</p>
              <p className="text-muted-foreground text-xs">
                Estoque: {product.stock === null ? "Ilimitado" : product.stock}
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-0.5 px-3 py-2 border-t border-border/50">
            <a
              href={`/loja/${product.slug}`}
              target="_blank"
              rel="noreferrer"
              title="Ver no site"
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink size={13} />
            </a>
            <DuplicateProductButton productId={product.id} />
            <Link
              href={`/admin/loja/${product.id}`}
              title="Editar"
              className="ml-auto p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Edit size={13} />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
