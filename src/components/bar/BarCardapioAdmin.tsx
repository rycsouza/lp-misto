"use client";

import { useState, useTransition, useCallback } from "react";
import {
  listBarMenuItems,
  createBarMenuItem,
  updateBarMenuItem,
  deleteBarMenuItem,
  listBarOfferings,
  upsertBarOffering,
  saveBarConfig,
} from "@/app/actions/bar";

type Category = "bebida" | "comida" | "outro";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  category: Category;
  priceCents: number;
  needsPrep: boolean;
  active: boolean;
  sortOrder: number;
}

interface OfferingRow {
  offeringId: string;
  menuItemId: string;
  priceCentsOverride: number | null;
  stockTotal: number | null;
  active: boolean;
}

interface Props {
  initialItems: MenuItem[];
  games: { id: string; label: string }[];
  initialConfig: { serviceFeeType: "percent" | "fixed"; serviceFeeValue: number; minOrderCents: number };
}

const centsToReais = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const reaisToCents = (s: string) => Math.round((parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0) * 100);
const CAT_LABEL: Record<Category, string> = { bebida: "Bebida", comida: "Comida", outro: "Outro" };

export function BarCardapioAdmin({ initialItems, games, initialConfig }: Props) {
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [isPending, startTransition] = useTransition();

  const refreshItems = useCallback(async () => {
    const rows = (await listBarMenuItems()) as MenuItem[];
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
      await saveBarConfig({ serviceFeeType: cfgType, serviceFeeValue: value, minOrderCents: reaisToCents(cfgMin) });
      setCfgSaved(true);
      setTimeout(() => setCfgSaved(false), 2500);
    });
  }

  // ── Form de item (create/edit) ──────────────────────────────────
  const empty = { name: "", description: "", category: "bebida" as Category, priceReais: "", needsPrep: false };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function editItem(it: MenuItem) {
    setEditingId(it.id);
    setForm({ name: it.name, description: it.description ?? "", category: it.category, priceReais: centsToReais(it.priceCents), needsPrep: it.needsPrep });
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
    };
    if (payload.name.length < 1) return setFormError("Informe o nome.");
    if (payload.priceCents <= 0) return setFormError("Informe um preço válido.");
    startTransition(async () => {
      const res = editingId ? await updateBarMenuItem(editingId, payload) : await createBarMenuItem(payload);
      if (!res.success) return setFormError(res.error ?? "Erro ao salvar.");
      resetForm();
      await refreshItems();
    });
  }

  function toggleActive(it: MenuItem) {
    startTransition(async () => {
      await updateBarMenuItem(it.id, {
        name: it.name, description: it.description, category: it.category,
        priceCents: it.priceCents, needsPrep: it.needsPrep, active: !it.active,
      });
      await refreshItems();
    });
  }

  function removeItem(id: string) {
    startTransition(async () => {
      await deleteBarMenuItem(id);
      await refreshItems();
    });
  }

  // ── Ofertas por jogo ────────────────────────────────────────────
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const [drafts, setDrafts] = useState<Record<string, { inCardapio: boolean; stock: string; price: string }>>({});
  const [offSaved, setOffSaved] = useState<string | null>(null);

  const loadOfferings = useCallback(
    async (gid: string) => {
      if (!gid) return;
      const rows = (await listBarOfferings(gid)) as OfferingRow[];
      const byItem = new Map(rows.map((r) => [r.menuItemId, r]));
      const next: Record<string, { inCardapio: boolean; stock: string; price: string }> = {};
      for (const it of items) {
        const o = byItem.get(it.id);
        next[it.id] = {
          inCardapio: !!o && o.active,
          stock: o?.stockTotal != null ? String(o.stockTotal) : "",
          price: o?.priceCentsOverride != null ? centsToReais(o.priceCentsOverride) : "",
        };
      }
      setDrafts(next);
    },
    [items]
  );

  function onGameChange(gid: string) {
    setGameId(gid);
    startTransition(() => { loadOfferings(gid); });
  }

  function saveOffering(it: MenuItem) {
    const d = drafts[it.id] ?? { inCardapio: false, stock: "", price: "" };
    startTransition(async () => {
      await upsertBarOffering({
        gameId,
        menuItemId: it.id,
        active: d.inCardapio,
        stockTotal: d.stock.trim() === "" ? null : Math.max(0, parseInt(d.stock, 10) || 0),
        priceCentsOverride: d.price.trim() === "" ? null : reaisToCents(d.price),
      });
      setOffSaved(it.id);
      setTimeout(() => setOffSaved(null), 2000);
    });
  }

  const inputCls = "bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      {/* CONFIG */}
      <section className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Taxa &amp; pedido mínimo</h2>
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
            <input value={cfgValue} onChange={(e) => setCfgValue(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Pedido mínimo (R$)
            <input value={cfgMin} onChange={(e) => setCfgMin(e.target.value)} className={inputCls} />
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
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Itens do cardápio</h2>

        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">{editingId ? "Editar item" : "Novo item"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))} className={inputCls}>
              <option value="bebida">Bebida</option>
              <option value="comida">Comida</option>
              <option value="outro">Outro</option>
            </select>
            <input placeholder="Preço (R$)" value={form.priceReais} onChange={(e) => setForm((f) => ({ ...f, priceReais: e.target.value }))} className={inputCls} />
            <input placeholder="Descrição (opcional)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input type="checkbox" checked={form.needsPrep} onChange={(e) => setForm((f) => ({ ...f, needsPrep: e.target.checked }))} className="w-4 h-4 accent-primary" />
            Precisa de preparo (passa pela cozinha)
          </label>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={saveItem} disabled={isPending} className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50">
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
                  <p className="text-sm text-primary font-semibold">R$ {centsToReais(it.priceCents)}</p>
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
      </section>

      {/* OFERTAS POR JOGO */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Cardápio por jogo (estoque &amp; preço)</h2>
        <select value={gameId} onChange={(e) => onGameChange(e.target.value)} className={inputCls}>
          {games.length === 0 && <option value="">Nenhum jogo</option>}
          {games.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>

        <div className="flex flex-col gap-2">
          {items.filter((i) => i.active).map((it) => {
            const d = drafts[it.id] ?? { inCardapio: false, stock: "", price: "" };
            return (
              <div key={it.id} className="bg-card border border-border rounded-xl p-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer flex-1 min-w-[140px]">
                  <input type="checkbox" checked={d.inCardapio} onChange={(e) => setDrafts((s) => ({ ...s, [it.id]: { ...d, inCardapio: e.target.checked } }))} className="w-4 h-4 accent-primary" />
                  {it.name}
                </label>
                <input placeholder="Estoque (∞)" value={d.stock} onChange={(e) => setDrafts((s) => ({ ...s, [it.id]: { ...d, stock: e.target.value } }))} className={`${inputCls} w-24`} />
                <input placeholder={`R$ ${centsToReais(it.priceCents)}`} value={d.price} onChange={(e) => setDrafts((s) => ({ ...s, [it.id]: { ...d, price: e.target.value } }))} className={`${inputCls} w-28`} />
                <button type="button" onClick={() => saveOffering(it)} disabled={isPending || !gameId} className="bg-secondary text-secondary-foreground rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50">
                  {offSaved === it.id ? "✓" : "Salvar"}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Estoque vazio = ilimitado. Preço vazio = usa o preço do item.</p>
      </section>
    </div>
  );
}
