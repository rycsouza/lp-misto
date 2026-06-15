"use client";

interface AdminDeleteButtonProps {
  action: () => Promise<void>;
  confirmMessage: string;
  label?: string;
}

export function AdminDeleteButton({ action, confirmMessage, label = "Excluir" }: AdminDeleteButtonProps) {
  return (
    <form action={action}>
      <button
        type="submit"
        onClick={(e) => { if (!confirm(confirmMessage)) e.preventDefault(); }}
        className="text-xs text-destructive hover:text-destructive/80 transition-colors px-2 py-1 rounded hover:bg-destructive/10"
      >
        {label}
      </button>
    </form>
  );
}
