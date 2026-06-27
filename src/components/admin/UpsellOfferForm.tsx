"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createUpsellOffer, updateUpsellOffer } from "@/app/actions/admin-growth";
import type { UpsellOfferRow, UpsellOfferInput, ProductPickerItem } from "@/app/actions/admin-growth";
import { CheckCircle2 } from "lucide-react";

type FormState = { success: boolean; id?: string; error?: string } | undefined;

export interface GameWithTypes {
  id: string;
  label: string; // ex: "vs Aquidauanense FC — 27/06"
  types: { code: string; name: string; priceCents: number }[];
}

interface UpsellOfferFormProps {
  offer?: UpsellOfferRow;
  products: ProductPickerItem[];
  games: GameWithTypes[];
}

type MinConditionType = "none" | "value" | "quantity";

const inputClass = "w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "text-sm text-muted-foreground mb-1 block";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseBRL(str: string): number {
  const clean = str.replace(/[^\d,]/g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : Math.round(n * 100);
}

function ProductPicker({
  products,
  selectedId,
  onSelect,
  label,
}: {
  products: ProductPickerItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  label: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-2">
      <label className={labelClass}>{label}</label>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar produto..."
        className={inputClass}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <p className="col-span-full text-muted-foreground text-xs text-center py-4">Nenhum produto encontrado</p>
        )}
        {filtered.map((p) => {
          const isSelected = selectedId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className={`relative flex flex-col items-center gap-1.5 p-2 rounded-lg border text-left transition-colors ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 bg-card"
              }`}
            >
              {isSelected && (
                <CheckCircle2 size={14} className="absolute top-1.5 right-1.5 text-primary" />
              )}
              <div className="w-12 h-12 rounded-md bg-secondary overflow-hidden flex items-center justify-center shrink-0">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground text-xs">{p.name.charAt(0)}</span>
                )}
              </div>
              <p className="text-xs text-foreground font-medium text-center leading-tight line-clamp-2 w-full">{p.name}</p>
              <p className="text-xs text-primary font-semibold">{formatBRL(p.priceCents)}</p>
            </button>
          );
        })}
      </div>
      {selectedId && (
        <p className="text-xs text-muted-foreground">
          Selecionado: <span className="text-foreground font-medium">{products.find((p) => p.id === selectedId)?.name ?? selectedId}</span>
        </p>
      )}
    </div>
  );
}

export function UpsellOfferForm({ offer, products, games }: UpsellOfferFormProps) {
  const router = useRouter();
  const isEditing = !!offer?.id;

  const [triggerType, setTriggerType] = useState(offer?.triggerType ?? "any");
  const [triggerProductId, setTriggerProductId] = useState(offer?.triggerProductId ?? "");
  const [offerType, setOfferType] = useState(offer?.offerType ?? "ticket");
  const [offerGameId, setOfferGameId] = useState(offer?.offerGameId ?? games[0]?.id ?? "");
  const selectedGame = games.find((g) => g.id === offerGameId);
  const gameTypes = selectedGame?.types ?? [];
  const [offerTicketType, setOfferTicketType] = useState(
    offer?.offerTicketType ?? games[0]?.types[0]?.code ?? "inteira"
  );
  const [offerProductId, setOfferProductId] = useState(offer?.offerProductId ?? "");
  const [offerQuantity, setOfferQuantity] = useState(offer?.offerQuantity ?? 1);
  const [discountPct, setDiscountPct] = useState(offer?.discountPct ?? 0);
  const [timerMinutes, setTimerMinutes] = useState(Math.round((offer?.timerSeconds ?? 300) / 60));

  const deriveMinType = (): MinConditionType => {
    if (offer?.minQuantity != null && offer.minQuantity > 0) return "quantity";
    if (offer?.minOrderCents && offer.minOrderCents > 0) return "value";
    return "none";
  };
  const [minConditionType, setMinConditionType] = useState<MinConditionType>(deriveMinType);
  const [minValue, setMinValue] = useState(
    offer?.minOrderCents ? (offer.minOrderCents / 100).toFixed(2).replace(".", ",") : ""
  );
  const [minQty, setMinQty] = useState(offer?.minQuantity ?? 1);

  // Compute auto price
  const computedOriginalPrice = (): number => {
    if (offerType === "ticket") {
      return gameTypes.find((t) => t.code === offerTicketType)?.priceCents ?? 0;
    }
    if (offerType === "product" && offerProductId) {
      return products.find((p) => p.id === offerProductId)?.priceCents ?? 0;
    }
    return 0;
  };

  const unitPrice = computedOriginalPrice();
  const bundleOriginal = unitPrice * offerQuantity;
  const bundleDiscounted = Math.round(bundleOriginal * (1 - discountPct / 100));
  const savings = bundleOriginal - bundleDiscounted;

  function parseFormData(formData: FormData): UpsellOfferInput {
    const tt = formData.get("triggerType") as UpsellOfferInput["triggerType"];
    const ot = formData.get("offerType") as UpsellOfferInput["offerType"];
    const qty = parseInt(formData.get("offerQuantity") as string, 10) || 1;
    const disc = parseInt(formData.get("discountPct") as string, 10) || 0;
    const timerMins = parseInt(formData.get("timerMinutes") as string, 10) || 5;
    const minType = formData.get("minConditionType") as MinConditionType;

    return {
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      triggerType: tt,
      triggerProductId: tt === "specific_product" ? (triggerProductId || null) : null,
      offerType: ot,
      offerProductId: ot === "product" ? (offerProductId || null) : null,
      offerTicketType: ot === "ticket" ? offerTicketType : null,
      offerGameId: ot === "ticket" ? (offerGameId || null) : null,
      offerQuantity: qty,
      originalPriceCents: computedOriginalPrice(),
      discountPct: disc,
      active: formData.get("active") === "on",
      minOrderCents: minType === "value" ? parseBRL(minValue) : 0,
      minQuantity: minType === "quantity" ? minQty : null,
      timerSeconds: timerMins * 60,
    };
  }

  async function handleCreate(_prev: FormState, formData: FormData): Promise<FormState> {
    return createUpsellOffer(parseFormData(formData));
  }
  async function handleUpdate(_prev: FormState, formData: FormData): Promise<FormState> {
    return updateUpsellOffer(offer!.id!, parseFormData(formData));
  }

  const [state, action, pending] = useActionState<FormState, FormData>(
    isEditing ? handleUpdate : handleCreate,
    undefined
  );

  useEffect(() => {
    if (state?.success) router.push("/admin/upsell");
  }, [state, router]);

  return (
    <form action={action} className="flex flex-col gap-6">

      {/* Nome + Descrição */}
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="name" className={labelClass}>Nome da oferta *</label>
          <input id="name" name="name" type="text" required defaultValue={offer?.name ?? ""}
            placeholder="Ex: 3 Ingressos com 20% de desconto" className={inputClass} />
        </div>
        <div>
          <label htmlFor="description" className={labelClass}>Descrição (opcional)</label>
          <textarea id="description" name="description" rows={2} defaultValue={offer?.description ?? ""}
            placeholder="Descrição exibida ao cliente no checkout..." className={inputClass} />
        </div>
      </div>

      <hr className="border-border" />

      {/* Trigger */}
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-foreground">Gatilho — quando exibir a oferta?</p>
        <div>
          <label htmlFor="triggerType" className={labelClass}>Condição de exibição</label>
          <select id="triggerType" name="triggerType" value={triggerType}
            onChange={(e) => setTriggerType(e.target.value)} className={inputClass}>
            <option value="any">Qualquer compra</option>
            <option value="ticket">Compra de ingresso</option>
            <option value="product">Compra de produto (qualquer)</option>
            <option value="specific_product">Produto específico no carrinho</option>
          </select>
        </div>
        {triggerType === "specific_product" && (
          <ProductPicker
            products={products}
            selectedId={triggerProductId}
            onSelect={setTriggerProductId}
            label="Produto que ativa a oferta *"
          />
        )}
      </div>

      <hr className="border-border" />

      {/* Oferta */}
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-foreground">O que será ofertado?</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="offerType" className={labelClass}>Tipo de oferta</label>
            <select id="offerType" name="offerType" value={offerType}
              onChange={(e) => { setOfferType(e.target.value); setOfferProductId(""); }} className={inputClass}>
              <option value="ticket">Ingresso</option>
              <option value="product">Produto</option>
            </select>
          </div>

          {offerType === "ticket" && (
            <div>
              <label htmlFor="offerTicketType" className={labelClass}>Tipo de ingresso</label>
              <select id="offerTicketType" name="offerTicketType" value={offerTicketType}
                onChange={(e) => setOfferTicketType(e.target.value)} className={inputClass}
                disabled={gameTypes.length === 0}>
                {gameTypes.length === 0 && <option value="">—</option>}
                {gameTypes.map((t) => (
                  <option key={t.code} value={t.code}>{t.name} — {formatBRL(t.priceCents)}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {offerType === "ticket" && (
          <div>
            <label htmlFor="offerGameId" className={labelClass}>Jogo dos ingressos *</label>
            {games.length === 0 ? (
              <p className="text-sm text-amber-500 bg-amber-500/10 rounded-md px-3 py-2">
                Nenhum jogo em casa cadastrado. Cadastre um jogo para oferecer ingressos no upsell.
              </p>
            ) : (
              <select id="offerGameId" value={offerGameId} className={inputClass}
                onChange={(e) => {
                  const gid = e.target.value;
                  setOfferGameId(gid);
                  // Ao trocar de jogo, ajusta o tipo para um válido daquele jogo
                  const g = games.find((x) => x.id === gid);
                  if (g && !g.types.some((t) => t.code === offerTicketType)) {
                    setOfferTicketType(g.types[0]?.code ?? "");
                  }
                }}>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Ao aceitar o upsell, o cliente recebe {offerQuantity} ingresso(s) deste tipo para este jogo.
            </p>
          </div>
        )}

        {offerType === "product" && (
          <ProductPicker
            products={products}
            selectedId={offerProductId}
            onSelect={setOfferProductId}
            label="Produto ofertado *"
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="offerQuantity" className={labelClass}>Quantidade</label>
            <input id="offerQuantity" name="offerQuantity" type="number" min={1} max={99}
              value={offerQuantity} onChange={(e) => setOfferQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className={inputClass} />
          </div>
          <div>
            <label htmlFor="discountPct" className={labelClass}>Desconto (%)</label>
            <input id="discountPct" name="discountPct" type="number" min={0} max={100} required
              value={discountPct} onChange={(e) => setDiscountPct(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
              className={inputClass} />
          </div>
        </div>

        {/* Preview de preço */}
        {unitPrice > 0 && (
          <div className="bg-secondary/50 border border-border rounded-lg px-4 py-3 flex flex-col gap-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Preço unitário</span>
              <span>{formatBRL(unitPrice)}</span>
            </div>
            {offerQuantity > 1 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({offerQuantity}×)</span>
                <span>{formatBRL(bundleOriginal)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Desconto ({discountPct}%)</span>
              <span className="text-destructive">− {formatBRL(savings)}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1 mt-0.5">
              <span>Cliente paga</span>
              <span className="text-primary">{formatBRL(bundleDiscounted)}</span>
            </div>
          </div>
        )}
      </div>

      <hr className="border-border" />

      {/* Condição mínima */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-foreground">Condição mínima para exibição</p>
        <input type="hidden" name="minConditionType" value={minConditionType} />
        <div className="flex gap-2">
          {(["none", "value", "quantity"] as MinConditionType[]).map((t) => (
            <button key={t} type="button" onClick={() => setMinConditionType(t)}
              className={`flex-1 py-2 rounded-md text-xs font-medium border transition-colors ${
                minConditionType === t
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-secondary border-border text-muted-foreground hover:text-foreground"
              }`}>
              {t === "none" && "Sem mínimo"}
              {t === "value" && "Valor mínimo (R$)"}
              {t === "quantity" && "Qtde mínima"}
            </button>
          ))}
        </div>
        {minConditionType === "value" && (
          <div>
            <label className={labelClass}>Valor mínimo do pedido</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">R$</span>
              <input type="text" value={minValue} onChange={(e) => setMinValue(e.target.value)}
                placeholder="0,00" className={`${inputClass} pl-8`} />
            </div>
          </div>
        )}
        {minConditionType === "quantity" && (
          <div>
            <label className={labelClass}>Quantidade mínima no pedido</label>
            <input type="number" min={1} value={minQty}
              onChange={(e) => setMinQty(Math.max(1, parseInt(e.target.value) || 1))}
              className={inputClass} />
          </div>
        )}
      </div>

      <hr className="border-border" />

      {/* Timer + Ativo */}
      <div className="grid grid-cols-2 gap-4 items-end">
        <div>
          <label htmlFor="timerMinutes" className={labelClass}>Timer (minutos)</label>
          <input id="timerMinutes" name="timerMinutes" type="number" min={1} max={60}
            value={timerMinutes} onChange={(e) => setTimerMinutes(Math.max(1, parseInt(e.target.value) || 5))}
            className={inputClass} />
          <p className="text-xs text-muted-foreground mt-1">{timerMinutes * 60}s — contador regressivo visível ao cliente</p>
        </div>
        <div className="pb-1">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
            <input type="checkbox" name="active" defaultChecked={offer?.active ?? true}
              className="w-4 h-4 rounded border-border bg-input" />
            Oferta ativa
          </label>
        </div>
      </div>

      {state && !state.success && state.error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{state.error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={pending}
          className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
          {pending ? "Salvando..." : isEditing ? "Salvar Oferta" : "Criar Oferta"}
        </button>
        <button type="button" onClick={() => router.push("/admin/upsell")}
          className="bg-secondary border border-border text-foreground rounded-md px-5 py-2.5 text-sm font-medium hover:bg-secondary/80 transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );
}
