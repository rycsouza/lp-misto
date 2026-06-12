"use client";

import { GripVertical } from "lucide-react";
import { ReorderButtons } from "@/components/admin/ReorderButtons";
import { TimelineEventActions } from "@/components/admin/TimelineEventActions";
import { useDragReorder } from "@/components/admin/useDragReorder";
import {
  moveTimelineEventUp,
  moveTimelineEventDown,
  reorderTimelineEvents,
} from "@/app/actions/admin-institutional";
import type { TimelineEventRow } from "@/app/actions/admin-institutional";

interface Props {
  events: TimelineEventRow[];
}

export function DraggableHistoriaTable({ events: initial }: Props) {
  const { rows, isSaving, getRowProps } = useDragReorder(initial, reorderTimelineEvents);

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
                Ano
              </th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                Título
              </th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                Descrição
              </th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                Ordem
              </th>
              <th className="text-right text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted-foreground py-10">
                  Nenhum evento cadastrado
                </td>
              </tr>
            )}
            {rows.map((event, idx) => (
              <tr key={event.id} {...getRowProps(idx)}>
                <td className="px-2 py-3 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                  <GripVertical size={14} />
                </td>
                <td className="px-4 py-3 text-foreground font-semibold">{event.year}</td>
                <td className="px-4 py-3 text-foreground font-medium max-w-xs">
                  <span className="block truncate" title={event.title}>{event.title}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground max-w-sm">
                  <span className="block truncate" title={event.description}>{event.description}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  <div className="flex items-center gap-2">
                    <span>{idx + 1}</span>
                    <ReorderButtons
                      onMoveUp={moveTimelineEventUp.bind(null, event.id)}
                      onMoveDown={moveTimelineEventDown.bind(null, event.id)}
                      isFirst={idx === 0}
                      isLast={idx === rows.length - 1}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <TimelineEventActions eventId={event.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
