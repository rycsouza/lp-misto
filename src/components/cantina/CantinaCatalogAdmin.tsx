"use client";

import { useState, useTransition, useCallback } from "react";
import {
  listCantinaItemsAdmin,
  createCantinaItem,
  updateCantinaItem,
  deleteCantinaItem,
  saveCantinaConfig,
} from "@/app/actions/cantina";

type Category = "bebida" | "comida" | "outro";

interface Item {
  id: string;
  name: string;
  description: string | null;
  category: Category;
  priceCents: number;
  needsPrep: boolean;
  stockCap: number | null;
  stockSold: number;
  active: boolean;
  sortOrder: number;
}

interface Props {
  initialItems: Item[];
  initialConfig: { serviceFeeType: "percent" | "fixed"; serviceFeeValue: number; minOrderCents: number };
}

const centsToReais = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const reaisToCents = (s: string) => Math.round((parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0) * 100);
// Máscara de moeda "estilo caixa eletrônico": só dígitos, últimos 2 = centavos.
const maskMoney = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  return (parseInt(digits, 10) / 100).toFixed(2).replace(".", ",");
};
const onlyDigits = (raw: string) => raw.replace(/\D/g, "").slice(0, 9);
const CAT_LABEL: Record<Category, string> = { bebida: "Bebida", comida: "Comida", outro: "Outro" };

export function CantinaCatalogAdmin({ initialItems, initialConfig }: Props) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [isPending, startTransition] = useTransition();

  const refreshItems = useCallback(async () => {
    const rows = (await listCantinaItemsAdmin()) as Item[];
    setItems(rows);
  }, []);

  // ── Config ──────────────────────────────────────────────────────
  const [cfgType, setCfgType] = useState(initialConfig.serviceFeeType);
  const [cfgValue, setCfgValue] = useState(
    initialConfig.serviceFeeType === "fixed" ? centsToReais(initialConfig.serviceFeeValue) : String(initialConfig.serviceFeeValue)
  );
  const [cfgMin, setCfgMin] = useState(centsToReais(initialConfig.minOrderCents));
  const [cfgSaved, setCfgSaved] = useState(false);

  function saveConfig() {
    startTransition(async () => {
      const value = cfgType === "fixed" ? reaisToCents(cfgValue) : Math.round(parseFloat(cfgValue.replace(",", ".")) || 0);
      await saveCantinaConfig({ serviceFeeType: cfgType, serviceFeeValue: value, minOrderCents: reaisToCents(cfgMin) });
      setCfgSaved(true);
      setTimeout(() => setCfgSaved(false), 2500);
    });
  }

  // ── Form de item ────────────────────────────────────────────────
  const empty = { name: "", description: "", category: "bebida" as Category, priceReais: "", needsPrep: false, cap: "" };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function editItem(it: Item) {
    setEditingId(it.id);
    setForm({
      name: it.name,
      description: it.description ?? "",
      category: it.category,
      priceReais: centsToReais(it.priceCents),
      needsPrep: it.needsPrep,
      cap: it.stockCap != null ? String(it.stockCap) : "",
    });
  }
  function resetForm() {
    setEditingId(null);
    setForm(empty);
    setFormError(null);
  }

  function saveItem() {
    setFormError(null);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category,
      priceCents: reaisToCents(form.priceReais),
      needsPrep: form.needsPrep,
      stockCap: form.cap.trim() === "" ? null : Math.max(0, parseInt(form.cap, 10) || 0),
    };
    if (payload.name.length < 1) return setFormError("Informe o nome.");
    if (payload.priceCents <= 0) return setFormError("Informe um preço válido.");
    startTransition(async () => {
      const res = editingId ? await updateCantinaItem(editingId, payload) : await createCantinaItem(payload);
      if (!res.success) return setFormError(res.error ?? "Erro ao salvar.");
      resetForm();
      await refreshItems();
    });
  }

  function toggleActive(it: Item) {
    startTransition(async () => {
      await updateCantinaItem(it.id, {
        name: it.name, description: it.description, category: it.category,
        priceCents: it.priceCents, needsPrep: it.needsPrep, stockCap: it.stockCap, active: !it.active,
      });
      await refreshItems();
    });
  }

  function removeItem(id: string) {
    startTransition(async () => {
      await deleteCantinaItem(id);
      await refreshItems();
    });
  }

  const inputCls = "bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";
  const inputErrCls = "bg-input border border-destructive rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

  // Validação em tempo real do formulário de item.
  const priceCentsLive = reaisToCents(form.priceReais);
  const priceInvalid = form.priceReais.trim() !== "" && priceCentsLive <= 0;
  const canSaveItem = form.name.trim().length >= 1 && priceCentsLive > 0;

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      {/* CONFIG */}
      <section className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Taxa &amp; compra mínima</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Tipo de taxa
            <select value={cfgType} onChange={(e) => setCfgType(e.target.value as "percent" | "fixed")} className={inputCls}>
              <option value="percent">Percentual (%)</option>
              <option value="fixed">Valor fixo (R$)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {cfgType === "percent" ? "Percentual (%)" : "Valor fixo (R$)"}
            <input
              inputMode="numeric" value={cfgValue}
              onChange={(e) => setCfgValue(cfgType === "percent" ? onlyDigits(e.target.value).slice(0, 3) : maskMoney(e.target.value))}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Compra mínima (R$)
            <input inputMode="numeric" value={cfgMin} onChange={(e) => setCfgMin(maskMoney(e.target.value))} className={inputCls} />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={saveConfig} disabled={isPending} className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            Salvar config
          </button>
          {cfgSaved && <span className="text-sm text-green-500">Salvo!</span>}
        </div>
      </section>

      {/* ITENS */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Itens à venda</h2>

        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">{editingId ? "Editar item" : "Novo item"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))} className={inputCls}>
              <option value="bebida">Bebida</option>
              <option value="comida">Comida</option>
              <option value="outro">Outro</option>
            </select>
            <input
              placeholder="Preço (R$)" inputMode="numeric" value={form.priceReais}
              onChange={(e) => setForm((f) => ({ ...f, priceReais: maskMoney(e.target.value) }))}
              className={priceInvalid ? inputErrCls : inputCls}
            />
            <input
              placeholder="Limite de venda (∞)" inputMode="numeric" value={form.cap}
              onChange={(e) => setForm((f) => ({ ...f, cap: onlyDigits(e.target.value) }))}
              className={inputCls}
            />
            <input placeholder="Descrição (opcional)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={`${inputCls} sm:col-span-2`} />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input type="checkbox" checked={form.needsPrep} onChange={(e) => setForm((f) => ({ ...f, needsPrep: e.target.checked }))} className="w-4 h-4 accent-primary" />
            Precisa de preparo (passa pela cozinha no resgate)
          </label>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={saveItem} disabled={isPending || !canSaveItem} className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {editingId ? "Salvar alterações" : "Adicionar item"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="bg-secondary text-secondary-foreground rounded-lg px-4 py-2 text-sm font-medium">
                Cancelar
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum item ainda.</p>
          ) : (
            items.map((it) => (
              <div key={it.id} className={`bg-card border rounded-xl p-3 flex items-center gap-3 ${it.active ? "border-border" : "border-border/50 opacity-60"}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {it.name}
                    <span className="ml-2 text-[10px] text-muted-foreground uppercase">{CAT_LABEL[it.category]}</span>
                    {it.needsPrep && <span className="ml-1.5 text-[10px] text-amber-500 uppercase">preparo</span>}
                  </p>
                  <p className="text-sm text-primary font-semibold">
                    R$ {centsToReais(it.priceCents)}
                    {it.stockCap != null && (
                      <span className="ml-2 text-xs text-muted-foreground font-normal">
                        vendidos {it.stockSold}/{it.stockCap}
                      </span>
                    )}
                  </p>
                </div>
                <button type="button" onClick={() => toggleActive(it)} className="text-xs text-muted-foreground hover:text-foreground">
                  {it.active ? "Desativar" : "Ativar"}
                </button>
                <button type="button" onClick={() => editItem(it)} className="text-xs text-primary hover:underline">Editar</button>
                <button type="button" onClick={() => removeItem(it.id)} className="text-xs text-destructive hover:underline">Excluir</button>
              </div>
            ))
          )}
        </div>
        <p className="text-xs text-muted-foreground">Limite vazio = venda ilimitada. O limite é global (não por jogo).</p>
      </section>
    </div>
  );
}
