"use client";

import { useState, useTransition } from "react";
import { ConfirmModal } from "@/components/admin/ConfirmModal";

interface AdminDeleteButtonProps {
  action: () => Promise<void>;
  confirmMessage: string;
  label?: string;
}

export function AdminDeleteButton({ action, confirmMessage, label = "Excluir" }: AdminDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setOpen(false);
    startTransition(() => action());
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className="text-xs text-destructive hover:text-destructive/80 transition-colors px-2 py-1 rounded hover:bg-destructive/10 disabled:opacity-50"
      >
        {isPending ? "..." : label}
      </button>
      <ConfirmModal
        open={open}
        title={confirmMessage}
        confirmLabel={label}
        isPending={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
