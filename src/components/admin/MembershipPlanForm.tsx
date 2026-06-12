"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createMembershipPlan,
  updateMembershipPlan,
  setPlanBenefits,
  createBenefit,
} from "@/app/actions/admin-growth";
import type {
  MembershipPlanRow,
  BenefitRow,
  MembershipPlanInput,
} from "@/app/actions/admin-growth";

type FormState = { success: boolean; id?: string; error?: string } | undefined;

interface MembershipPlanFormProps {
  plan?: MembershipPlanRow & { benefits?: BenefitRow[] };
  allBenefits: BenefitRow[];
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function MembershipPlanForm({
  plan,
  allBenefits,
}: MembershipPlanFormProps) {
  const router = useRouter();
  const isEditing = !!plan?.id;

  const [slugManual, setSlugManual] = useState(false);
  const [nameValue, setNameValue] = useState(plan?.name ?? "");
  const [slugValue, setSlugValue] = useState(plan?.slug ?? "");
  const [selectedBenefits, setSelectedBenefits] = useState<Set<string>>(
    new Set(plan?.benefits?.map((b) => b.id) ?? [])
  );
  const [newBenefitLabel, setNewBenefitLabel] = useState("");
  const [localBenefits, setLocalBenefits] = useState<BenefitRow[]>(allBenefits);
  const [benefitError, setBenefitError] = useState<string | null>(null);

  const inputClass =
    "w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";
  const labelClass = "text-sm text-muted-foreground mb-1 block";

  function handleNameChange(value: string) {
    setNameValue(value);
    if (!slugManual) {
      setSlugValue(toSlug(value));
    }
  }

  function parseFormData(formData: FormData): MembershipPlanInput {
    const priceStr = formData.get("priceCents") as string;
    return {
      name: formData.get("name") as string,
      slug: formData.get("slug") as string,
      icon: formData.get("icon") as string,
      priceCents: Math.round(
        parseFloat(priceStr.replace(",", ".")) * 100
      ),
      highlight: formData.get("highlight") === "on",
      active: formData.get("active") === "on",
      order: parseInt((formData.get("order") as string) ?? "0", 10),
    };
  }

  async function handleCreate(
    _prev: FormState,
    formData: FormData
  ): Promise<FormState> {
    const result = await createMembershipPlan(parseFormData(formData));
    if (result.success && result.id) {
      await setPlanBenefits(result.id, Array.from(selectedBenefits));
    }
    return result;
  }

  async function handleUpdate(
    _prev: FormState,
    formData: FormData
  ): Promise<FormState> {
    const result = await updateMembershipPlan(plan!.id!, parseFormData(formData));
    if (result.success) {
      await setPlanBenefits(plan!.id!, Array.from(selectedBenefits));
    }
    return result;
  }

  const [state, action, pending] = useActionState<FormState, FormData>(
    isEditing ? handleUpdate : handleCreate,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      router.push("/admin/socios");
    }
  }, [state, router]);

  function toggleBenefit(id: string) {
    setSelectedBenefits((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleCreateBenefit() {
    if (!newBenefitLabel.trim()) return;
    setBenefitError(null);
    const result = await createBenefit(newBenefitLabel.trim());
    if (result.success && result.id) {
      const newBenefit: BenefitRow = {
        id: result.id,
        label: newBenefitLabel.trim(),
        order: 0,
      };
      setLocalBenefits((prev) => [...prev, newBenefit]);
      setSelectedBenefits((prev) => new Set([...prev, result.id!]));
      setNewBenefitLabel("");
    } else {
      setBenefitError(result.error ?? "Erro ao criar benefício");
    }
  }

  return (
    <form action={action} className="flex flex-col gap-5">
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
            placeholder="Ex: Plano Ouro"
          />
        </div>

        <div>
          <label htmlFor="slug" className={labelClass}>
            Slug (URL)
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
            placeholder="plano-ouro"
          />
        </div>

        <div>
          <label htmlFor="icon" className={labelClass}>
            Ícone Lucide
          </label>
          <input
            id="icon"
            name="icon"
            type="text"
            required
            defaultValue={plan?.icon ?? ""}
            className={inputClass}
            placeholder="Ex: Star, Heart, Trophy"
          />
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
            defaultValue={plan?.priceCents ? formatPrice(plan.priceCents) : ""}
            className={inputClass}
            placeholder="Ex: 29,90"
          />
        </div>

        <div>
          <label htmlFor="order" className={labelClass}>
            Ordem de exibição
          </label>
          <input
            id="order"
            name="order"
            type="number"
            min={0}
            defaultValue={plan?.order ?? 0}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
          <input
            type="checkbox"
            name="highlight"
            defaultChecked={plan?.highlight ?? false}
            className="w-4 h-4 rounded border-border bg-input"
          />
          Plano Destaque
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
          <input
            type="checkbox"
            name="active"
            defaultChecked={plan?.active ?? true}
            className="w-4 h-4 rounded border-border bg-input"
          />
          Ativo
        </label>
      </div>

      {/* Benefícios */}
      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Benefícios
        </h4>

        {localBenefits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum benefício cadastrado ainda.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {localBenefits.map((benefit) => (
              <label
                key={benefit.id}
                className="flex items-center gap-2 cursor-pointer text-sm text-foreground p-2 rounded-md hover:bg-secondary/30 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedBenefits.has(benefit.id)}
                  onChange={() => toggleBenefit(benefit.id)}
                  className="w-4 h-4 rounded border-border bg-input"
                />
                {benefit.label}
              </label>
            ))}
          </div>
        )}

        {/* Criar novo benefício inline */}
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            value={newBenefitLabel}
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
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {benefitError}
          </p>
        )}
      </div>

      {state && !state.success && state.error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {pending ? "Salvando..." : isEditing ? "Salvar Plano" : "Criar Plano"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/socios")}
          className="bg-secondary border border-border text-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
