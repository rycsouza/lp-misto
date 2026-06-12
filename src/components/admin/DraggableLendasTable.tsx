"use client";

import { GripVertical } from "lucide-react";
import { ReorderButtons } from "@/components/admin/ReorderButtons";
import { LegendActions } from "@/components/admin/LegendActions";
import { useDragReorder } from "@/components/admin/useDragReorder";
import { moveLegendUp, moveLegendDown, reorderLegends } from "@/app/actions/admin-institutional";
import type { LegendRow } from "@/app/actions/admin-institutional";

interface Props {
  legends: LegendRow[];
}

export function DraggableLendasTable({ legends: initial }: Props) {
  const { rows, isSaving, getRowProps } = useDragReorder(initial, reorderLegends);

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
                Posição
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
                <td colSpan={7} className="text-center text-muted-foreground py-10">
                  Nenhuma lenda cadastrada
                </td>
              </tr>
            )}
            {rows.map((legend, idx) => (
              <tr key={legend.id} {...getRowProps(idx)}>
                <td className="px-2 py-3 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                  <GripVertical size={14} />
                </td>
                <td className="px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden flex items-center justify-center">
                    {legend.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={legend.photoUrl} alt={legend.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-muted-foreground">{legend.name.charAt(0)}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-foreground font-medium">{legend.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{legend.position ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  <div className="flex items-center gap-2">
                    <span>{idx + 1}</span>
                    <ReorderButtons
                      onMoveUp={moveLegendUp.bind(null, legend.id)}
                      onMoveDown={moveLegendDown.bind(null, legend.id)}
                      isFirst={idx === 0}
                      isLast={idx === rows.length - 1}
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      legend.active
                        ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600"
                        : "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"
                    }
                  >
                    {legend.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <LegendActions legendId={legend.id} isActive={legend.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
