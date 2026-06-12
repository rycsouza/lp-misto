"use client";

import { useTransition } from "react";
import { toggleNewsActive, deleteNews } from "@/app/actions/admin-content";
import Link from "next/link";
import { Edit, Trash2, Eye, EyeOff } from "lucide-react";

interface NewsActionsProps {
  newsId: string;
  isActive: boolean;
}

export function NewsActions({ newsId, isActive }: NewsActionsProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await toggleNewsActive(newsId, !isActive);
    });
  }

  function handleDelete() {
    if (!confirm("Tem certeza que deseja desativar esta notícia?")) return;
    startTransition(async () => {
      await deleteNews(newsId);
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
        href={`/admin/noticias/${newsId}`}
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
