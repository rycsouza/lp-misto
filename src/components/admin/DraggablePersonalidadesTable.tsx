"use client";

import { GripVertical } from "lucide-react";
import { ReorderButtons } from "@/components/admin/ReorderButtons";
import { PersonalityActions } from "@/components/admin/PersonalityActions";
import { useDragReorder } from "@/components/admin/useDragReorder";
import {
  movePersonalityUp,
  movePersonalityDown,
  reorderPersonalities,
} from "@/app/actions/admin-institutional";
import type { PersonalityRow } from "@/app/actions/admin-institutional";

const categoryLabels: Record<string, string> = {
  medicos: "Médicos",
  dirigentes: "Dirigentes",
  tecnicos: "Técnicos",
  voluntarios: "Voluntários",
};

const categoryColors: Record<string, string> = {
  medicos: "bg-red-500/15 text-red-600",
  dirigentes: "bg-blue-500/15 text-blue-600",
  tecnicos: "bg-green-500/15 text-green-600",
  voluntarios: "bg-amber-500/15 text-amber-600",
};

interface Props {
  personalities: PersonalityRow[];
}

export function DraggablePersonalidadesTable({ personalities: initial }: Props) {
  const { rows, isSaving, getRowProps } = useDragReorder(initial, reorderPersonalities);

  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden"
      style={{ opacity: isSaving ? 0.6 : 1, transition: "opacity 0.15s" }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-6 px-2 py-3" />
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                Foto
              </th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                Nome
              </th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                Cargo
              </th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                Categoria
              </th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                Ordem
              </th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                Ativo
              </th>
              <th className="text-right text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted-foreground py-10">
                  Nenhuma personalidade encontrada
                </td>
              </tr>
            )}
            {rows.map((p, idx) => (
              <tr key={p.id} {...getRowProps(idx)}>
                <td className="px-2 py-3 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                  <GripVertical size={14} />
                </td>
                <td className="px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden flex items-center justify-center">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-muted-foreground">{p.name.charAt(0)}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-foreground font-medium">{p.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.role ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${categoryColors[p.category] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {categoryLabels[p.category] ?? p.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  <div className="flex items-center gap-2">
                    <span>{idx + 1}</span>
                    <ReorderButtons
                      onMoveUp={movePersonalityUp.bind(null, p.id)}
                      onMoveDown={movePersonalityDown.bind(null, p.id)}
                      isFirst={idx === 0}
                      isLast={idx === rows.length - 1}
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      p.active
                        ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600"
                        : "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"
                    }
                  >
                    {p.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <PersonalityActions personalityId={p.id} isActive={p.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
