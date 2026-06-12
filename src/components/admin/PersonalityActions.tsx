"use client";

import { useTransition } from "react";
import {
  togglePersonalityActive,
  deletePersonality,
} from "@/app/actions/admin-institutional";
import Link from "next/link";
import { Edit, Trash2, Eye, EyeOff } from "lucide-react";

interface PersonalityActionsProps {
  personalityId: string;
  isActive: boolean;
}

export function PersonalityActions({
  personalityId,
  isActive,
}: PersonalityActionsProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await togglePersonalityActive(personalityId, !isActive);
    });
  }

  function handleDelete() {
    if (!confirm("Tem certeza que deseja desativar esta personalidade?"))
      return;
    startTransition(async () => {
      await deletePersonality(personalityId);
    });
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      <button
        onClick={handleToggle}
        disabled={isPending}
        title={isActive ? "Desativar" : "Ativar"}
        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        {isActive ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
      <Link
        href={`/admin/personalidades/${personalityId}`}
        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
        title="Editar"
      >
        <Edit size={15} />
      </Link>
      <button
        onClick={handleDelete}
        disabled={isPending}
        title="Excluir (soft delete)"
        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
