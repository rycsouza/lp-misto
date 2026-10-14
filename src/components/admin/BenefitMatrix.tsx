"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import {
  createBenefit,
  deleteBenefit,
  moveBenefitDown,
  moveBenefitUp,
  renameBenefit,
  saveBenefitMatrix,
} from "@/app/actions/admin-growth";
import type {
  BenefitRow,
  MembershipPlanRow,
  PlanBenefitRow,
} from "@/app/actions/admin-growth";

export type MatrixPlan = MembershipPlanRow & { benefits: PlanBenefitRow[] };

interface BenefitMatrixProps {
  /** Só planos ativos, na ordem de exibição (colunas). */
  plans: MatrixPlan[];
  benefits: BenefitRow[];
}

interface CellState {
  included: boolean;
  detail: string;
}

const cellKey = (benefitId: string, planId: string) => `${benefitId}:${planId}`;

/** Linhas fixas: benefícios automáticos derivados dos campos do plano (somente leitura). */
const AUTOMATIC_ROWS: { label: string; value: (p: MatrixPlan) => string }[] = [
  {
    label: "Desconto em produtos",
    value: (p) => (p.productDiscountPct > 0 ? `${p.productDiscountPct}%` : "—"),
  },
  {
    label: "Desconto em ingressos",
    value: (p) => (p.ticketDiscountPct > 0 ? `${p.ticketDiscountPct}%` : "—"),
  },
  {
    label: "Ingressos grátis por jogo em casa",
    value: (p) => (p.freeTicketsPerHomeGame > 0 ? String(p.freeTicketsPerHomeGame) : "—"),
  },
];

function initialCells(plans: MatrixPlan[]): Record<string, CellState> {
  const out: Record<string, CellState> = {};
  for (const plan of plans) {
    for (const b of plan.benefits) {
      out[cellKey(b.id, plan.id)] = { included: true, detail: b.detail ?? "" };
    }
  }
  return out;
}

/**
 * A matriz é remontada quando a ordem dos benefícios ou dos planos muda no servidor
 * (depois de subir/descer), assim o estado local nunca fica defasado.
 */
export function BenefitMatrix(props: BenefitMatrixProps) {
  const key = [
    props.benefits.map((b) => b.id).join(","),
    "|",
    props.plans.map((p) => p.id).join(","),
  ].join("");
  return <BenefitMatrixBody key={key} {...props} />;
}

function BenefitMatrixBody({ plans, benefits }: BenefitMatrixProps) {
  const router = useRouter();
  const [rows, setRows] = useState<BenefitRow[]>(benefits);
  const [cells, setCells] = useState<Record<string, CellState>>(() => initialCells(plans));
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [pending, startTransition] = useTransition();

  function toggleCell(benefitId: string, planId: string) {
    const k = cellKey(benefitId, planId);
    setCells((prev) => {
      const current = prev[k] ?? { included: false, detail: "" };
      return { ...prev, [k]: { ...current, included: !current.included } };
    });
    setDirty(true);
  }

  function setDetail(benefitId: string, planId: string, detail: string) {
    const k = cellKey(benefitId, planId);
    setCells((prev) => ({
      ...prev,
      [k]: { included: prev[k]?.included ?? true, detail },
    }));
    setDirty(true);
  }

  function saveRename(id: string) {
    const label = editingLabel.trim();
    setMessage(null);
    startTransition(async () => {
      const result = await renameBenefit(id, label);
      if (result.success) {
        setRows((prev) => prev.map((b) => (b.id === id ? { ...b, label } : b)));
        setEditingId(null);
      } else {
        setMessage({ ok: false, text: result.error ?? "Não foi possível renomear." });
      }
    });
  }

  function move(id: string, direction: "up" | "down") {
    setMessage(null);
    startTransition(async () => {
      if (direction === "up") await moveBenefitUp(id);
      else await moveBenefitDown(id);
      router.refresh();
    });
  }

  function removeBenefit(b: BenefitRow) {
    if (!window.confirm(`Excluir o benefício "${b.label}"? Ele sai de todos os planos.`)) return;
    setMessage(null);
    startTransition(async () => {
      const result = await deleteBenefit(b.id);
      if (result.success) {
        setRows((prev) => prev.filter((x) => x.id !== b.id));
        setCells((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(next)) if (k.startsWith(`${b.id}:`)) delete next[k];
          return next;
        });
      }
    });
  }

  function addBenefit() {
    const label = newLabel.trim();
    if (!label) return;
    setMessage(null);
    startTransition(async () => {
      const result = await createBenefit(label);
      if (result.success && result.id) {
        setRows((prev) => [...prev, { id: result.id!, label, order: prev.length }]);
        setNewLabel("");
      } else {
        setMessage({ ok: false, text: result.error ?? "Não foi possível criar o benefício." });
      }
    });
  }

  function save() {
    setMessage(null);
    const payload = {
      planIds: plans.map((p) => p.id),
      cells: rows.flatMap((b) =>
        plans.flatMap((p) => {
          const c = cells[cellKey(b.id, p.id)];
          return c?.included
            ? [{ benefitId: b.id, planId: p.id, detail: c.detail.trim() || null }]
            : [];
        })
      ),
    };
    startTransition(async () => {
      const result = await saveBenefitMatrix(payload);
      if (result.success) {
        setDirty(false);
        setMessage({ ok: true, text: "Matriz salva." });
      } else {
        setMessage({ ok: false, text: result.error ?? "Não foi possível salvar a matriz." });
      }
    });
  }

  const inputClass =
    "bg-input border border-border rounded-md px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";
  const actionClass =
    "inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-xs text-foreground hover:bg-secondary transition-colors disabled:opacity-40";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {dirty ? "Alterações não salvas." : "Tudo salvo."} Subir/descer só funciona sem alterações pendentes.
        </p>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {pending ? "Salvando..." : "Salvar matriz"}
        </button>
      </div>

      {message && (
        <p
          role="status"
          className={`text-sm rounded-md px-3 py-2 ${
            message.ok ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* Rolagem horizontal própria: a página não estoura no celular. */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 bg-card text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3 min-w-[240px]">
                Benefício
              </th>
              {plans.map((plan) => (
                <th key={plan.id} className="text-left px-3 py-3 min-w-[170px] align-top">
                  <p className="text-foreground font-semibold normal-case text-sm">{plan.name}</p>
                  <Link
                    href={`/admin/socios/planos/${plan.id}`}
                    className="text-xs text-primary hover:underline normal-case"
                  >
                    Editar plano →
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-secondary/20">
              <td colSpan={plans.length + 1} className="px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
                Automáticos (vêm dos campos do plano)
              </td>
            </tr>
            {AUTOMATIC_ROWS.map((row) => (
              <tr key={row.label} className="border-t border-border/50">
                <td className="sticky left-0 z-10 bg-card px-4 py-2.5 text-muted-foreground">{row.label}</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-3 py-2.5 text-muted-foreground">{row.value(plan)}</td>
                ))}
              </tr>
            ))}

            <tr className="bg-secondary/20">
              <td colSpan={plans.length + 1} className="px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
                Benefícios cadastrados
              </td>
            </tr>
            {rows.length === 0 && (
              <tr className="border-t border-border/50">
                <td colSpan={plans.length + 1} className="px-4 py-4 text-muted-foreground">
                  Nenhum benefício ainda. Adicione abaixo.
                </td>
              </tr>
            )}
            {rows.map((b, index) => (
              <tr key={b.id} className="border-t border-border/50 align-top">
                <td className="sticky left-0 z-10 bg-card px-4 py-2.5">
                  {editingId === b.id ? (
                    <div className="flex flex-col gap-2 min-w-[220px]">
                      <input
                        type="text"
                        aria-label="Novo nome do benefício"
                        maxLength={80}
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        className={inputClass}
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => saveRename(b.id)} disabled={pending || !editingLabel.trim()} className={actionClass}>
                          Salvar nome
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className={actionClass}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 min-w-[220px]">
                      <span className="text-foreground font-medium">{b.label}</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(b.id);
                            setEditingLabel(b.label);
                          }}
                          disabled={pending}
                          className={actionClass}
                        >
                          <Pencil size={12} /> Renomear
                        </button>
                        <button
                          type="button"
                          onClick={() => move(b.id, "up")}
                          disabled={pending || dirty || index === 0}
                          aria-label={`Subir ${b.label}`}
                          className={actionClass}
                        >
                          <ChevronUp size={12} /> Subir
                        </button>
                        <button
                          type="button"
                          onClick={() => move(b.id, "down")}
                          disabled={pending || dirty || index === rows.length - 1}
                          aria-label={`Descer ${b.label}`}
                          className={actionClass}
                        >
                          <ChevronDown size={12} /> Descer
                        </button>
                        <button
                          type="button"
                          onClick={() => removeBenefit(b)}
                          disabled={pending}
                          className={`${actionClass} text-destructive`}
                        >
                          <Trash2 size={12} /> Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </td>
                {plans.map((plan) => {
                  const c = cells[cellKey(b.id, plan.id)] ?? { included: false, detail: "" };
                  return (
                    <td key={plan.id} className="px-3 py-2.5">
                      <label className="flex items-center gap-2 cursor-pointer text-foreground">
                        <input
                          type="checkbox"
                          checked={c.included}
                          onChange={() => toggleCell(b.id, plan.id)}
                          className="w-4 h-4 rounded border-border bg-input"
                        />
                        <span className="text-xs text-muted-foreground">Inclui</span>
                      </label>
                      {c.included && (
                        <input
                          type="text"
                          aria-label={`Detalhe de ${b.label} no plano ${plan.name}`}
                          maxLength={60}
                          value={c.detail}
                          onChange={(e) => setDetail(b.id, plan.id, e.target.value)}
                          placeholder="Detalhe (opcional)"
                          className={`${inputClass} mt-1.5 w-full min-w-[140px]`}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 max-w-md">
        <input
          type="text"
          value={newLabel}
          maxLength={80}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addBenefit();
            }
          }}
          placeholder="Novo benefício..."
          className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={addBenefit}
          disabled={pending || !newLabel.trim()}
          className="bg-secondary border border-border text-foreground rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}
