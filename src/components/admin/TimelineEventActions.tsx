"use client";

import { useTransition, useState } from "react";
import { deleteTimelineEvent } from "@/app/actions/admin-institutional";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import Link from "next/link";
import { Edit, Trash2 } from "lucide-react";

interface TimelineEventActionsProps {
  eventId: string;
}

export function TimelineEventActions({ eventId }: TimelineEventActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleConfirmDelete() {
    setConfirmOpen(false);
    startTransition(async () => {
      await deleteTimelineEvent(eventId);
    });
  }

  return (
    <>
      <div className="flex items-center gap-2 justify-end">
        <Link
          href={`/admin/historia/${eventId}`}
          className="p-2 sm:p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          title="Editar"
          aria-label="Editar"
        >
          <Edit size={15} />
        </Link>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={isPending}
          title="Excluir permanentemente"
          aria-label="Excluir"
          className="p-2 sm:p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <ConfirmModal
        open={confirmOpen}
        title="Excluir evento?"
        description="Esta ação é permanente e não pode ser desfeita."
        confirmLabel="Excluir"
        isPending={isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
