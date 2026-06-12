"use client";

import { useTransition } from "react";
import { deleteTimelineEvent } from "@/app/actions/admin-institutional";
import Link from "next/link";
import { Edit, Trash2 } from "lucide-react";

interface TimelineEventActionsProps {
  eventId: string;
}

export function TimelineEventActions({ eventId }: TimelineEventActionsProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Tem certeza que deseja excluir este evento? Esta ação é permanente."))
      return;
    startTransition(async () => {
      await deleteTimelineEvent(eventId);
    });
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      <Link
        href={`/admin/historia/${eventId}`}
        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
        title="Editar"
      >
        <Edit size={15} />
      </Link>
      <button
        onClick={handleDelete}
        disabled={isPending}
        title="Excluir permanentemente"
        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
