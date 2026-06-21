"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ImageUpload } from "./ImageUpload";
import {
  createProduct,
  updateProduct,
  createVariant,
  deleteVariant,
  toggleVariantActive,
} from "@/app/actions/admin-shop";
import type { ProductRow, VariantRow } from "@/app/actions/admin-shop";

type FormState = { success: boolean; id?: string; error?: string } | undefined;

interface ProductFormProps {
  product?: ProductRow & { variants?: VariantRow[] };
}

const SIZES = ["PP", "P", "M", "G", "GG", "XGG", "Único"] as const;

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();
  const isEditing = !!product?.id;
  const [slugManual, setSlugManual] = useState(false);
  const [nameValue, setNameValue] = useState(product?.name ?? "");
  const [slugValue, setSlugValue] = useState(product?.slug ?? "");
  const [addingVariant, setAddingVariant] = useState(false);
  const [variantState, setVariantState] = useState<{
    success?: boolean;
    error?: string;
  } | null>(null);

  const inputClass =
    "w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";
  const labelClass = "text-sm text-muted-foreground mb-1 block";

  function parseSalePrice(str: string | null): number | null {
    if (!str || !str.trim()) return null;
    const n = parseFloat(str.replace(",", "."));
    return isNaN(n) || n <= 0 ? null : Math.round(n * 100);
  }

  function parseIntField(val: string | null): number | null {
    if (!val || !val.trim()) return null;
    const n = parseInt(val, 10);
    return isNaN(n) || n <= 0 ? null : n;
  }

  async function handleCreate(
    _prev: FormState,
    formData: FormData
  ): Promise<FormState> {
    const priceStr = formData.get("priceCents") as string;
    const stockStr = formData.get("stock") as string;
    const saleEndsAtStr = formData.get("saleEndsAt") as string;
    return createProduct({
      name: formData.get("name") as string,
      slug: formData.get("slug") as string,
      category: formData.get("category") as "camisa_oficial" | "camisa_torcedor",
      priceCents: Math.round(parseFloat(priceStr.replace(",", ".")) * 100),
      salePriceCents: parseSalePrice(formData.get("salePriceCents") as string),
      saleEndsAt: saleEndsAtStr ? new Date(saleEndsAtStr) : null,
      imageUrl: (formData.get("imageUrl") as string) || null,
      active: formData.get("active") === "on",
      comingSoon: formData.get("comingSoon") === "on",
      limitedStock: formData.get("limitedStock") === "on",
      stock: stockStr ? parseInt(stockStr, 10) : null,
      requiresShipping: formData.get("requiresShipping") === "on",
      weightGrams: parseIntField(formData.get("weightGrams") as string),
      widthCm: parseIntField(formData.get("widthCm") as string),
      heightCm: parseIntField(formData.get("heightCm") as string),
      lengthCm: parseIntField(formData.get("lengthCm") as string),
    });
  }

  async function handleUpdate(
    _prev: FormState,
    formData: FormData
  ): Promise<FormState> {
    const priceStr = formData.get("priceCents") as string;
    const stockStr = formData.get("stock") as string;
    const saleEndsAtStr = formData.get("saleEndsAt") as string;
    return updateProduct(product!.id!, {
      name: formData.get("name") as string,
      slug: formData.get("slug") as string,
      category: formData.get("category") as "camisa_oficial" | "camisa_torcedor",
      priceCents: Math.round(parseFloat(priceStr.replace(",", ".")) * 100),
      salePriceCents: parseSalePrice(formData.get("salePriceCents") as string),
      saleEndsAt: saleEndsAtStr ? new Date(saleEndsAtStr) : null,
      imageUrl: (formData.get("imageUrl") as string) || null,
      active: formData.get("active") === "on",
      comingSoon: formData.get("comingSoon") === "on",
      limitedStock: formData.get("limitedStock") === "on",
      stock: stockStr ? parseInt(stockStr, 10) : null,
      requiresShipping: formData.get("requiresShipping") === "on",
      weightGrams: parseIntField(formData.get("weightGrams") as string),
      widthCm: parseIntField(formData.get("widthCm") as string),
      heightCm: parseIntField(formData.get("heightCm") as string),
      lengthCm: parseIntField(formData.get("lengthCm") as string),
    });
  }

  const [state, action, pending] = useActionState<FormState, FormData>(
    isEditing ? handleUpdate : handleCreate,
    undefined
  );

  useEffect(() => {
    if (state?.success && !isEditing) {
      router.push("/admin/loja");
    }
  }, [state, router, isEditing]);

  function handleNameChange(value: string) {
    setNameValue(value);
    if (!slugManual) {
      setSlugValue(toSlug(value));
    }
  }

  async function handleAddVariant(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!product?.id) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const stockStr = fd.get("vstock") as string;
    const result = await createVariant({
      productId: product.id,
      color: (fd.get("vcolor") as string) || null,
      colorImageUrl: (fd.get("vcolorImageUrl") as string) || null,
      size: fd.get("vsize") as string,
      stock: stockStr ? parseInt(stockStr, 10) : null,
      active: true,
    });
    setVariantState(result);
    if (result.success) {
      form.reset();
      setAddingVariant(false);
      router.refresh();
    }
  }

  async function handleDeleteVariant(variantId: string) {
    await deleteVariant(variantId);
    router.refresh();
  }

  async function handleToggleVariant(variantId: string, active: boolean) {
    await toggleVariantActive(variantId, active);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Produto */}
      <form action={action} className="flex flex-col gap-5">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Dados do Produto
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="name" className={labelClass}>
              Nome
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={nameValue}
              onChange={(e) => handleNameChange(e.target.value)}
              className={inputClass}
              placeholder="Ex: Camisa Oficial 2025"
            />
          </div>

          <div>
            <label htmlFor="slug" className={labelClass}>
              Slug (URL) *
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              required
              value={slugValue}
              onChange={(e) => {
                setSlugManual(true);
                setSlugValue(e.target.value);
              }}
              className={inputClass}
              placeholder="camisa-oficial-2025"
              maxLength={120}
              pattern="[a-z0-9\-]+"
              title="Apenas letras minúsculas, números e hífens"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Gerado automaticamente pelo nome. Edite para personalizar.
            </p>
          </div>

          <div>
            <label htmlFor="category" className={labelClass}>
              Categoria
            </label>
            <select
              id="category"
              name="category"
              required
              defaultValue={product?.category ?? "camisa_oficial"}
              className={inputClass}
            >
              <option value="camisa_oficial">Camisa Oficial</option>
              <option value="camisa_torcedor">Camisa Torcedor</option>
            </select>
          </div>

          <div>
            <label htmlFor="priceCents" className={labelClass}>
              Preço (R$)
            </label>
            <input
              id="priceCents"
              name="priceCents"
              type="text"
              required
              defaultValue={
                product?.priceCents ? formatPrice(product.priceCents) : ""
              }
              className={inputClass}
              placeholder="Ex: 89,90"
            />
          </div>

          <div>
            <label htmlFor="salePriceCents" className={labelClass}>
              Preço promocional (R$) — opcional
            </label>
            <input
              id="salePriceCents"
              name="salePriceCents"
              type="text"
              defaultValue={product?.salePriceCents ? formatPrice(product.salePriceCents) : ""}
              className={inputClass}
              placeholder="Ex: 69,90 (deixe vazio para desativar)"
            />
            <p className="text-xs text-muted-foreground mt-1">Exibe badge "Promoção" e preço riscado na loja.</p>
          </div>

          <div>
            <label htmlFor="saleEndsAt" className={labelClass}>
              Promoção válida até (opcional)
            </label>
            <input
              id="saleEndsAt"
              name="saleEndsAt"
              type="datetime-local"
              defaultValue={
                product?.saleEndsAt
                  ? (() => {
                      const d = new Date(product.saleEndsAt);
                      const pad = (n: number) => String(n).padStart(2, "0");
                      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    })()
                  : ""
              }
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground mt-1">Deixe vazio para promoção sem prazo.</p>
          </div>

          <div className="sm:col-span-2">
            <ImageUpload
              name="imageUrl"
              defaultValue={product?.imageUrl}
              label="Imagem do Produto (opcional)"
              folder="misto/loja"
              aspectRatio="1:1"
            />
          </div>

          <div>
            <label htmlFor="stock" className={labelClass}>
              Estoque base (deixe vazio para ilimitado)
            </label>
            <input
              id="stock"
              name="stock"
              type="number"
              min={0}
              defaultValue={product?.stock ?? ""}
              className={inputClass}
              placeholder="Ilimitado"
            />
          </div>
        </div>

        {/* Dimensões para cálculo de frete */}
        <div>
          <p className="text-sm font-medium text-foreground mb-1">Dimensões para frete</p>
          <p className="text-xs text-muted-foreground mb-3">
            Usadas para calcular o frete via Melhor Envio. Deixe vazio para usar os valores padrão (500g, 30×20×5 cm).
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="weightGrams" className={labelClass}>Peso (g)</label>
              <input
                id="weightGrams"
                name="weightGrams"
                type="number"
                min={1}
                step={1}
                defaultValue={product?.weightGrams ?? ""}
                className={inputClass}
                placeholder="500"
              />
            </div>
            <div>
              <label htmlFor="widthCm" className={labelClass}>Largura (cm)</label>
              <input
                id="widthCm"
                name="widthCm"
                type="number"
                min={1}
                step={1}
                defaultValue={product?.widthCm ?? ""}
                className={inputClass}
                placeholder="20"
              />
            </div>
            <div>
              <label htmlFor="heightCm" className={labelClass}>Altura (cm)</label>
              <input
                id="heightCm"
                name="heightCm"
                type="number"
                min={1}
                step={1}
                defaultValue={product?.heightCm ?? ""}
                className={inputClass}
                placeholder="5"
              />
            </div>
            <div>
              <label htmlFor="lengthCm" className={labelClass}>Comprimento (cm)</label>
              <input
                id="lengthCm"
                name="lengthCm"
                type="number"
                min={1}
                step={1}
                defaultValue={product?.lengthCm ?? ""}
                className={inputClass}
                placeholder="30"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
            <input
              type="checkbox"
              name="active"
              defaultChecked={product?.active ?? true}
              className="w-4 h-4 rounded border-border bg-input"
            />
            Ativo (exibir na loja)
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
            <input
              type="checkbox"
              name="comingSoon"
              defaultChecked={product?.comingSoon ?? false}
              className="w-4 h-4 rounded border-border bg-input"
            />
            Em Breve (exibe badge e formulário de lista de espera)
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
            <input
              type="checkbox"
              name="limitedStock"
              defaultChecked={product?.limitedStock ?? false}
              className="w-4 h-4 rounded border-border bg-input"
            />
            Estoque Limitado (exibe badge de urgência no produto)
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
            <input
              type="checkbox"
              name="requiresShipping"
              defaultChecked={product?.requiresShipping ?? true}
              className="w-4 h-4 rounded border-border bg-input"
            />
            Requer envio físico (inclui no cálculo de frete)
          </label>
        </div>

        {state && !state.success && state.error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {state.error}
          </p>
        )}

        {state?.success && isEditing && (
          <p className="text-sm text-green-600 bg-green-500/10 rounded-md px-3 py-2">
            Produto atualizado com sucesso!
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {pending ? "Salvando..." : isEditing ? "Salvar Produto" : "Criar Produto"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/loja")}
            className="bg-secondary border border-border text-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>

      {/* Variantes — só no modo edição */}
      {isEditing && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Variantes
            </h3>
            <button
              type="button"
              onClick={() => setAddingVariant((v) => !v)}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              + Nova Variante
            </button>
          </div>

          {/* Lista de variantes existentes */}
          {product.variants && product.variants.length > 0 ? (
            <div className="bg-card border border-border rounded-xl overflow-hidden">

              {/* Mobile: cards */}
              <div className="sm:hidden divide-y divide-border/50">
                {product.variants.map((variant) => (
                  <div key={variant.id} className="px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary text-foreground">
                          {variant.size}
                        </span>
                        {variant.color && (
                          <span className="text-sm text-foreground">{variant.color}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleVariant(variant.id, !variant.active)}
                        className={
                          variant.active
                            ? "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600 cursor-pointer hover:opacity-80 shrink-0"
                            : "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground cursor-pointer hover:opacity-80 shrink-0"
                        }
                      >
                        {variant.active ? "Ativo" : "Inativo"}
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        Estoque: {variant.stock === null ? "Ilimitado" : variant.stock}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteVariant(variant.id)}
                        className="text-destructive hover:opacity-80 transition-opacity text-xs font-medium"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: tabela */}
              <table className="hidden sm:table w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Cor</th>
                    <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Tamanho</th>
                    <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Estoque</th>
                    <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-right text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((variant) => (
                    <tr key={variant.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-foreground">{variant.color ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary text-foreground">
                          {variant.size}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {variant.stock === null ? "Ilimitado" : variant.stock}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleVariant(variant.id, !variant.active)}
                          className={
                            variant.active
                              ? "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600 cursor-pointer hover:opacity-80"
                              : "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground cursor-pointer hover:opacity-80"
                          }
                        >
                          {variant.active ? "Ativo" : "Inativo"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteVariant(variant.id)}
                          className="text-destructive hover:opacity-80 transition-opacity text-xs font-medium"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nenhuma variante cadastrada.
            </p>
          )}

          {/* Form inline para nova variante */}
          {addingVariant && (
            <form
              onSubmit={handleAddVariant}
              className="bg-secondary/30 border border-border rounded-xl p-4 flex flex-col gap-4"
            >
              <h4 className="text-sm font-semibold text-foreground">
                Adicionar Variante
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="vcolor" className={labelClass}>
                    Cor (opcional)
                  </label>
                  <input
                    id="vcolor"
                    name="vcolor"
                    type="text"
                    className={inputClass}
                    placeholder="Ex: Branca"
                  />
                </div>
                <div>
                  <label htmlFor="vsize" className={labelClass}>
                    Tamanho
                  </label>
                  <select
                    id="vsize"
                    name="vsize"
                    required
                    className={inputClass}
                  >
                    {SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <ImageUpload
                    name="vcolorImageUrl"
                    label="Imagem da Cor (opcional)"
                    folder="misto/loja/variantes"
                    aspectRatio="1:1"
                  />
                </div>
                <div>
                  <label htmlFor="vstock" className={labelClass}>
                    Estoque (vazio = ilimitado)
                  </label>
                  <input
                    id="vstock"
                    name="vstock"
                    type="number"
                    min={0}
                    className={inputClass}
                    placeholder="Ilimitado"
                  />
                </div>
              </div>

              {variantState && !variantState.success && variantState.error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  {variantState.error}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Adicionar Variante
                </button>
                <button
                  type="button"
                  onClick={() => setAddingVariant(false)}
                  className="bg-secondary border border-border text-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-secondary/80 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
