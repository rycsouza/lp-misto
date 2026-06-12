"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resendInvite, deleteInvite } from "@/app/actions/admin-auth";

interface InviteActionButtonsProps {
  inviteId: string;
  email: string;
}

export function InviteActionButtons({ inviteId, email }: InviteActionButtonsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"resend" | "delete" | null>(null);

  async function handleResend() {
    setLoading("resend");
    const result = await resendInvite(inviteId);
    setLoading(null);
    if (result.success) {
      router.refresh();
    }
  }

  async function handleDelete() {
    if (!confirm(`Cancelar convite para ${email}?`)) return;
    setLoading("delete");
    await deleteInvite(inviteId);
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      <button
        type="button"
        disabled={loading !== null}
        onClick={handleResend}
        className="text-xs text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded hover:bg-primary/10 disabled:opacity-50"
      >
        {loading === "resend" ? "..." : "Reenviar"}
      </button>
      <button
        type="button"
        disabled={loading !== null}
        onClick={handleDelete}
        className="text-xs text-destructive hover:text-destructive/80 transition-colors px-2 py-1 rounded hover:bg-destructive/10 disabled:opacity-50"
      >
        {loading === "delete" ? "..." : "Cancelar"}
      </button>
    </div>
  );
}
