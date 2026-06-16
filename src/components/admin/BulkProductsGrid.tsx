"use client";

import { useState, useRef } from "react";
import { type ProductRow } from "@/app/actions/admin-shop";
import { reorderProducts } from "@/app/actions/admin-shop";
import { ProductImageCarousel } from "./ProductImageCarousel";
import { DuplicateProductButton } from "./DuplicateProductButton";
import Link from "next/link";
import { ExternalLink, Edit, GripVertical, Check, Loader2 } from "lucide-react";

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
  const [items, setItems] = useState<ProductRow[]>(rows);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const dragOverId = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (rows.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
        Nenhum produto encontrado
      </div>
    );
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnter(id: string) {
    dragOverId.current = id;
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const fromId = draggingId;
    const toId = dragOverId.current;
    setDraggingId(null);
    dragOverId.current = null;

    if (!fromId || !toId || fromId === toId) return;

    const newItems = [...items];
    const fromIdx = newItems.findIndex((i) => i.id === fromId);
    const toIdx = newItems.findIndex((i) => i.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = newItems.splice(fromIdx, 1);
    newItems.splice(toIdx, 0, moved);
    setItems(newItems);

    // Persist new order
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    await reorderProducts(newItems.map((item, idx) => ({ id: item.id, order: idx })));
    setSaveState("saved");
    saveTimer.current = setTimeout(() => setSaveState("idle"), 2000);
  }

  function handleDragEnd() {
    setDraggingId(null);
    dragOverId.current = null;
  }

  return (
    <div className="flex flex-col gap-3">
      {saveState !== "idle" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {saveState === "saving" ? (
            <><Loader2 size={12} className="animate-spin" /> Salvando ordem...</>
          ) : (
            <><Check size={12} className="text-green-500" /> Ordem salva</>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <GripVertical size={12} />
        Arraste os produtos para reordenar
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((product) => (
          <div
            key={product.id}
            draggable
            onDragStart={(e) => handleDragStart(e, product.id)}
            onDragEnter={() => handleDragEnter(product.id)}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            className={`bg-card border border-border rounded-xl overflow-hidden flex flex-col hover:border-primary/50 transition-all select-none ${
              draggingId === product.id ? "opacity-40 scale-95" : ""
            }`}
          >
            {/* Drag handle bar */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-secondary/20 cursor-grab active:cursor-grabbing">
              <GripVertical size={13} className="text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground/60 font-mono">
                #{items.indexOf(product) + 1}
              </span>
            </div>

            <Link href={`/admin/loja/${product.id}`} className="p-4 flex flex-col gap-3 flex-1" onClick={(e) => draggingId ? e.preventDefault() : undefined}>
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
                  {product.comingSoon && (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/15 text-yellow-600">
                      Em Breve
                    </span>
                  )}
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
    </div>
  );
}
