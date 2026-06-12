"use client";

import { useState, useTransition } from "react";
import { bulkUpdateProductsActive, bulkDeleteProducts, type ProductRow } from "@/app/actions/admin-shop";
import { ProductImageCarousel } from "./ProductImageCarousel";
import { DuplicateProductButton } from "./DuplicateProductButton";
import Link from "next/link";
import { ExternalLink, Edit, Eye, EyeOff, Trash2 } from "lucide-react";

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function showFeedback(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  }

  function handleBulkActivate(active: boolean) {
    const ids = [...selected];
    startTransition(async () => {
      const result = await bulkUpdateProductsActive(ids, active);
      setSelected(new Set());
      showFeedback(`${result.updated} produto${result.updated !== 1 ? "s" : ""} ${active ? "ativado" : "desativado"}${result.updated !== 1 ? "s" : ""}.`);
    });
  }

  function handleBulkDelete() {
    const ids = [...selected];
    startTransition(async () => {
      const result = await bulkDeleteProducts(ids);
      setSelected(new Set());
      showFeedback(`${result.deleted} produto${result.deleted !== 1 ? "s" : ""} desativado${result.deleted !== 1 ? "s" : ""}.`);
    });
  }

  return (
    <>
      {/* Toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-lg px-4 py-2.5 text-sm flex-wrap">
          <span className="text-foreground font-medium">
            {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
          </span>
          <div className="flex-1" />
          <button
            onClick={() => handleBulkActivate(true)}
            disabled={isPending}
            className="flex items-center gap-1.5 bg-green-500/15 text-green-600 border border-green-500/20 rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-green-500/25 disabled:opacity-50 transition-colors"
          >
            <Eye size={13} />
            Ativar
          </button>
          <button
            onClick={() => handleBulkActivate(false)}
            disabled={isPending}
            className="flex items-center gap-1.5 bg-secondary text-muted-foreground border border-border rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-secondary/80 disabled:opacity-50 transition-colors"
          >
            <EyeOff size={13} />
            Desativar
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={isPending}
            className="flex items-center gap-1.5 bg-red-500/15 text-red-600 border border-red-500/20 rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-red-500/25 disabled:opacity-50 transition-colors"
          >
            <Trash2 size={13} />
            Excluir
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Desmarcar
          </button>
        </div>
      )}

      {feedback && (
        <p className="text-sm text-green-600 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2">
          {feedback}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          Nenhum produto encontrado
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rows.map((product) => {
            const isSelected = selected.has(product.id);
            return (
              <div
                key={product.id}
                className={`bg-card border rounded-xl overflow-hidden flex flex-col transition-colors ${
                  isSelected
                    ? "border-primary shadow-sm shadow-primary/20"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {/* Checkbox header */}
                <div
                  className="flex items-center gap-2 px-3 pt-3 pb-0 cursor-pointer"
                  onClick={() => toggle(product.id)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(product.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-border w-4 h-4 cursor-pointer accent-primary flex-shrink-0"
                  />
                  <span className="text-xs text-muted-foreground truncate select-none">
                    {isSelected ? "Selecionado" : "Selecionar"}
                  </span>
                </div>

                <Link
                  href={`/admin/loja/${product.id}`}
                  className="p-4 flex flex-col gap-3 flex-1"
                >
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
                    <p className="text-foreground font-medium text-sm leading-tight">
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                        {CATEGORY_LABELS[product.category] ?? product.category}
                      </span>
                      <span
                        className={
                          product.active
                            ? "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600"
                            : "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"
                        }
                      >
                        {product.active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <p className="text-foreground font-semibold text-sm">
                      {formatPrice(product.priceCents)}
                    </p>
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
            );
          })}
        </div>
      )}
    </>
  );
}
