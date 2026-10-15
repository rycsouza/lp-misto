"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createBenefit,
  saveMembershipPlan,
} from "@/app/actions/admin-growth";
import type {
  MembershipPlanRow,
  BenefitRow,
  PlanBenefitRow,
  MembershipPlanInput,
} from "@/app/actions/admin-growth";
import { PlanCard, type PlanCardData } from "@/components/membership/PlanCard";
import {
  buildPlanBenefitLines,
  endOfDaySaoPaulo,
  isFirstMonthPromoActive,
  promoEndDateInputValue,
  promoUntilLabel,
} from "@/lib/membership/plan-benefits";

interface MembershipPlanFormProps {
  plan?: MembershipPlanRow & { benefits?: PlanBenefitRow[] };
  allBenefits: BenefitRow[];
}

/** Cor padrão do cartão quando o plano ainda não tem cor própria. */
const DEFAULT_CARD_COLOR = "#c19a5a";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Máscara de preço: os dígitos digitados são centavos ("2990" → "29,90"). */
function centsToInput(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function inputToCents(raw: string): number {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  return digits ? parseInt(digits, 10) : 0;
}

function clampInt(raw: string, min: number, max: number): number {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

const inputClass =
  "w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "text-sm text-muted-foreground mb-1 block";
const checkClass = "flex items-center gap-2 cursor-pointer text-sm text-foreground";
const checkboxInputClass = "w-4 h-4 rounded border-border bg-input";

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function MembershipPlanForm({ plan, allBenefits }: MembershipPlanFormProps) {
  const router = useRouter();
  const isEditing = !!plan?.id;
  const [isPending, startTransition] = useTransition();
  // Fixado na montagem: a prévia não muda de "agora" a cada tecla.
  const [now] = useState(() => new Date());

  // Dados do plano
  const [name, setName] = useState(plan?.name ?? "");
  const [slug, setSlug] = useState(plan?.slug ?? "");
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState(plan?.description ?? "");
  const [priceCents, setPriceCents] = useState(plan?.priceCents ?? 0);
  const [active, setActive] = useState(plan?.active ?? true);

  // Vitrine
  const [order, setOrder] = useState(plan?.order ?? 0);
  const [highlight, setHighlight] = useState(plan?.highlight ?? false);
  const [highlightLabel, setHighlightLabel] = useState(plan?.highlightLabel ?? "");
  const [useClubColor, setUseClubColor] = useState(plan ? plan.cardColor === null : true);
  const [cardColor, setCardColor] = useState(plan?.cardColor ?? DEFAULT_CARD_COLOR);

  // Benefícios automáticos
  const [productDiscountPct, setProductDiscountPct] = useState(plan?.productDiscountPct ?? 0);
  const [ticketDiscountPct, setTicketDiscountPct] = useState(plan?.ticketDiscountPct ?? 0);
  const [freeTicketsPerHomeGame, setFreeTicketsPerHomeGame] = useState(plan?.freeTicketsPerHomeGame ?? 0);

  // Promoção
  const [firstMonthFree, setFirstMonthFree] = useState(plan?.firstMonthFree ?? false);
  const [promoEndsAt, setPromoEndsAt] = useState(promoEndDateInputValue(plan?.promoEndsAt ?? null));

  // Benefícios incluídos: presença na chave = incluído; valor = detalhe do plano.
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries((plan?.benefits ?? []).map((b) => [b.id, b.detail ?? ""]))
  );
  const [localBenefits, setLocalBenefits] = useState<BenefitRow[]>(allBenefits);
  const [newBenefitLabel, setNewBenefitLabel] = useState("");
  const [benefitError, setBenefitError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugManual) setSlug(toSlug(value));
  }

  function toggleBenefit(id: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (id in next) {
        delete next[id];
      } else {
        next[id] = "";
      }
      return next;
    });
  }

  function setBenefitDetail(id: string, detail: string) {
    setSelected((prev) => ({ ...prev, [id]: detail }));
  }

  async function handleCreateBenefit() {
    const label = newBenefitLabel.trim();
    if (!label) return;
    setBenefitError(null);
    const result = await createBenefit(label);
    if (result.success && result.id) {
      const created: BenefitRow = { id: result.id, label, order: localBenefits.length };
      setLocalBenefits((prev) => [...prev, created]);
      setSelected((prev) => ({ ...prev, [result.id!]: "" }));
      setNewBenefitLabel("");
    } else {
      setBenefitError(result.error ?? "Erro ao criar benefício");
    }
  }

  // Prévia: mesmo cálculo da vitrine (plan-benefits.ts).
  const promoEnd = endOfDaySaoPaulo(promoEndsAt);
  const promoActive = isFirstMonthPromoActive(
    { firstMonthFree, promoEndsAt: promoEnd },
    now
  );
  const previewData: PlanCardData = {
    name: name.trim() || "Nome do plano",
    description: description.trim() || null,
    priceCents,
    highlight,
    highlightLabel,
    cardColor: useClubColor ? null : cardColor,
    promoFirstMonthFree: promoActive,
    promoUntil: promoActive && promoEnd ? promoUntilLabel(promoEnd.toISOString()) : null,
    benefitLines: buildPlanBenefitLines(
      { ticketDiscountPct, productDiscountPct, freeTicketsPerHomeGame },
      localBenefits
        .filter((b) => b.id in selected)
        .map((b) => ({ id: b.id, label: b.label, detail: selected[b.id] }))
    ),
  };

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data: MembershipPlanInput = {
      name,
      slug,
      description: description.trim() || null,
      priceCents,
      ticketDiscountPct,
      productDiscountPct,
      freeTicketsPerHomeGame,
      firstMonthFree,
      promoEndsAt: firstMonthFree && promoEndsAt ? promoEndsAt : null,
      highlightLabel: highlight && highlightLabel.trim() ? highlightLabel.trim() : null,
      cardColor: useClubColor ? null : cardColor,
      highlight,
      active,
      order,
    };
    const benefits = Object.entries(selected).map(([benefitId, detail]) => ({
      benefitId,
      detail: detail.trim() || null,
    }));
    startTransition(async () => {
      const result = await saveMembershipPlan(plan?.id ?? null, data, benefits);
      if (result.success) {
        router.push("/admin/socios");
      } else {
        setError(result.error ?? "Não foi possível salvar o plano.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
      <div className="flex flex-col gap-6">
        <FormSection title="Dados do plano">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className={labelClass}>Nome</label>
              <input
                id="name"
                type="text"
                required
                maxLength={60}
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className={inputClass}
                placeholder="Ex: Plano Ouro"
              />
            </div>
            <div>
              <label htmlFor="slug" className={labelClass}>Slug (URL)</label>
              <input
                id="slug"
                type="text"
                required
                maxLength={60}
                value={slug}
                onChange={(e) => {
                  setSlugManual(true);
                  setSlug(e.target.value);
                }}
                className={inputClass}
                placeholder="plano-ouro"
              />
            </div>
            <div>
              <label htmlFor="priceCents" className={labelClass}>Preço mensal</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                  R$
                </span>
                <input
                  id="priceCents"
                  type="text"
                  inputMode="numeric"
                  required
                  value={centsToInput(priceCents)}
                  onChange={(e) => setPriceCents(inputToCents(e.target.value))}
                  className={`${inputClass} pl-9`}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="flex items-end">
              <label className={checkClass}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className={checkboxInputClass}
                />
                Plano ativo (aparece na vitrine)
              </label>
            </div>
          </div>
          <div>
            <label htmlFor="description" className={labelClass}>Descrição curta (opcional)</label>
            <input
              id="description"
              type="text"
              maxLength={140}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              placeholder="Ex: Para quem quer apoiar o clube"
            />
          </div>
        </FormSection>

        <FormSection title="Vitrine" description="Como o cartão aparece para o torcedor.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="order" className={labelClass}>Ordem de exibição</label>
              <input
                id="order"
                type="number"
                min={0}
                max={999}
                value={order}
                onChange={(e) => setOrder(clampInt(e.target.value, 0, 999))}
                className={inputClass}
              />
            </div>
            <div className="flex items-end">
              <label className={checkClass}>
                <input
                  type="checkbox"
                  checked={highlight}
                  onChange={(e) => setHighlight(e.target.checked)}
                  className={checkboxInputClass}
                />
                Plano destaque (só um por vez)
              </label>
            </div>
            <div>
              <label htmlFor="highlightLabel" className={labelClass}>Etiqueta do destaque</label>
              <input
                id="highlightLabel"
                type="text"
                maxLength={24}
                value={highlightLabel}
                onChange={(e) => setHighlightLabel(e.target.value)}
                disabled={!highlight}
                className={`${inputClass} disabled:opacity-50`}
                placeholder="MAIS POPULAR"
              />
              <p className="text-xs text-muted-foreground mt-1">Vazio = &quot;MAIS POPULAR&quot;.</p>
            </div>
            <div>
              <span className={labelClass}>Cor do cartão</span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  aria-label="Cor do cartão"
                  value={cardColor}
                  disabled={useClubColor}
                  onChange={(e) => setCardColor(e.target.value.toLowerCase())}
                  className="h-10 w-16 bg-input border border-border rounded-md p-1 disabled:opacity-40"
                />
                <label className={checkClass}>
                  <input
                    type="checkbox"
                    checked={useClubColor}
                    onChange={(e) => setUseClubColor(e.target.checked)}
                    className={checkboxInputClass}
                  />
                  Usar a cor do clube
                </label>
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection title="Benefícios automáticos" description="Viram linhas do cartão sozinhos. Zero = não aparece.">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="productDiscountPct" className={labelClass}>Desconto em produtos (%)</label>
              <input
                id="productDiscountPct"
                type="number"
                min={0}
                max={100}
                value={productDiscountPct}
                onChange={(e) => setProductDiscountPct(clampInt(e.target.value, 0, 100))}
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground mt-1">Aplicado no checkout da loja.</p>
            </div>
            <div>
              <label htmlFor="ticketDiscountPct" className={labelClass}>Desconto em ingressos (%)</label>
              <input
                id="ticketDiscountPct"
                type="number"
                min={0}
                max={100}
                value={ticketDiscountPct}
                onChange={(e) => setTicketDiscountPct(clampInt(e.target.value, 0, 100))}
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground mt-1">Aplicado no checkout de ingressos.</p>
            </div>
            <div>
              <label htmlFor="freeTicketsPerHomeGame" className={labelClass}>Ingressos grátis por jogo em casa</label>
              <select
                id="freeTicketsPerHomeGame"
                value={freeTicketsPerHomeGame}
                onChange={(e) => setFreeTicketsPerHomeGame(clampInt(e.target.value, 0, 10))}
                className={`${inputClass} form-select`}
              >
                {Array.from({ length: 11 }, (_, n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">O sócio resgata na área logada.</p>
            </div>
          </div>
        </FormSection>

        <FormSection title="Benefícios incluídos" description="Marque o que este plano inclui. O detalhe é opcional (ex.: 3 segundos).">
          {localBenefits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum benefício cadastrado ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {localBenefits.map((benefit) => {
                const isOn = benefit.id in selected;
                return (
                  <div key={benefit.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-md hover:bg-secondary/30 transition-colors">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground sm:w-1/2">
                      <input
                        type="checkbox"
                        checked={isOn}
                        onChange={() => toggleBenefit(benefit.id)}
                        className={checkboxInputClass}
                      />
                      {benefit.label}
                    </label>
                    {isOn && (
                      <input
                        type="text"
                        aria-label={`Detalhe de ${benefit.label}`}
                        maxLength={60}
                        value={selected[benefit.id]}
                        onChange={(e) => setBenefitDetail(benefit.id, e.target.value)}
                        placeholder="Detalhe (opcional)"
                        className="flex-1 bg-input border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={newBenefitLabel}
              maxLength={80}
              onChange={(e) => setNewBenefitLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateBenefit();
                }
              }}
              placeholder="Novo benefício..."
              className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={handleCreateBenefit}
              disabled={!newBenefitLabel.trim()}
              className="bg-secondary border border-border text-foreground rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors"
            >
              Adicionar
            </button>
          </div>
          {benefitError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{benefitError}</p>
          )}
        </FormSection>

        <FormSection title="Promoção">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={`${checkClass} sm:pt-6`}>
              <input
                type="checkbox"
                checked={firstMonthFree}
                onChange={(e) => setFirstMonthFree(e.target.checked)}
                className={checkboxInputClass}
              />
              1º mês grátis (só cartão)
            </label>
            <div>
              <label htmlFor="promoEndsAt" className={labelClass}>Válido até (opcional)</label>
              <input
                id="promoEndsAt"
                type="date"
                value={promoEndsAt}
                disabled={!firstMonthFree}
                onChange={(e) => setPromoEndsAt(e.target.value)}
                className={`${inputClass} disabled:opacity-50`}
              />
              <p className="text-xs text-muted-foreground mt-1">Vazio = sem data-limite. O mês grátis vale na adesão com cartão.</p>
            </div>
          </div>
        </FormSection>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isPending ? "Salvando..." : isEditing ? "Salvar plano" : "Criar plano"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/socios")}
            className="bg-secondary border border-border text-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>

      <aside className="lg:sticky lg:top-6 h-fit flex flex-col gap-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prévia na vitrine</p>
        <div className="pt-3">
          <PlanCard plan={previewData} />
        </div>
      </aside>
    </form>
  );
}
