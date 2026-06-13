"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { ReorderButtons } from "@/components/admin/ReorderButtons";
import { BoardMemberActions } from "@/components/admin/BoardMemberActions";
import {
  moveBoardMemberUp,
  moveBoardMemberDown,
  reorderBoardMembers,
} from "@/app/actions/admin-institutional";

export interface BoardMemberRow {
  id: string;
  name: string;
  role: string;
  profession: string | null;
  group: string;
  fiscalType: string | null;
  order: number;
  active: boolean;
  photoUrl: string | null;
}

const groupLabels: Record<string, string> = {
  executive: "Executiva",
  fiscal: "Conselho Fiscal",
};

const fiscalTypeLabels: Record<string, string> = {
  titular: "Titular",
  suplente: "Suplente",
};

interface DraggableBoardTableProps {
  members: BoardMemberRow[];
  groupKey: string;
}

export function DraggableBoardTable({ members: initial, groupKey }: DraggableBoardTableProps) {
  const [members, setMembers] = useState(initial);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  async function handleDrop(dropIndex: number) {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...members];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    setMembers(next);
    setDragIndex(null);
    setOverIndex(null);
    setIsSaving(true);
    try {
      await reorderBoardMembers(next.map((m) => m.id));
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden"
      style={{ opacity: isSaving ? 0.6 : 1, transition: "opacity 0.15s" }}
    >

      {/* ── Mobile cards ─────────────────────────────────── */}
      <div className="md:hidden divide-y divide-border/50">
        {members.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">Nenhum membro cadastrado</p>
        )}
        {members.map((member, idx) => (
          <div key={member.id} className="px-4 py-3 flex flex-col gap-1.5 hover:bg-secondary/20 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-secondary overflow-hidden flex items-center justify-center shrink-0">
                {member.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-muted-foreground">{member.name.charAt(0)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-medium text-sm truncate">{member.name}</p>
                <p className="text-muted-foreground text-xs">{member.role}</p>
              </div>
              <span className={member.active
                ? "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600 shrink-0"
                : "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground shrink-0"}>
                {member.active ? "Ativo" : "Inativo"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{groupLabels[member.group] ?? member.group}</span>
                {member.fiscalType && <span>· {fiscalTypeLabels[member.fiscalType] ?? member.fiscalType}</span>}
                {member.profession && <span>· {member.profession}</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <ReorderButtons
                  onMoveUp={moveBoardMemberUp.bind(null, member.id)}
                  onMoveDown={moveBoardMemberDown.bind(null, member.id)}
                  isFirst={idx === 0}
                  isLast={idx === members.length - 1}
                />
                <BoardMemberActions memberId={member.id} isActive={member.active} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Desktop table ─────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-6 px-2 py-3" />
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Foto</th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Nome</th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Cargo</th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Profissão</th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Grupo</th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Tipo</th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Ordem</th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Ativo</th>
              <th className="text-right text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center text-muted-foreground py-8">Nenhum membro cadastrado</td>
              </tr>
            )}
            {members.map((member, idx) => {
              const isDragging = dragIndex === idx;
              const isOver = overIndex === idx && dragIndex !== null && dragIndex !== idx;
              return (
                <tr
                  key={member.id}
                  draggable
                  onDragStart={() => setDragIndex(idx)}
                  onDragOver={(e) => { e.preventDefault(); setOverIndex(idx); }}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                  className={[
                    "border-b border-border/50 transition-colors select-none",
                    isDragging ? "opacity-30" : "hover:bg-secondary/30",
                    isOver ? "bg-primary/10 border-t-2 border-t-primary" : "",
                  ].join(" ")}
                >
                  <td className="px-2 py-3 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                    <GripVertical size={14} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden flex items-center justify-center shrink-0">
                      {member.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-muted-foreground">{member.name.charAt(0)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium">{member.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{member.role}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{member.profession ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {groupLabels[member.group] ?? member.group}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {member.fiscalType ? fiscalTypeLabels[member.fiscalType] ?? member.fiscalType : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    <div className="flex items-center gap-2">
                      <span>{idx + 1}</span>
                      <ReorderButtons
                        onMoveUp={moveBoardMemberUp.bind(null, member.id)}
                        onMoveDown={moveBoardMemberDown.bind(null, member.id)}
                        isFirst={idx === 0}
                        isLast={idx === members.length - 1}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={member.active
                      ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600"
                      : "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"}>
                      {member.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <BoardMemberActions memberId={member.id} isActive={member.active} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
