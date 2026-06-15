"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check } from "lucide-react";
import { resendInvite, deleteInvite } from "@/app/actions/admin-auth";
import { ConfirmModal } from "@/components/admin/ConfirmModal";

interface InviteActionButtonsProps {
  inviteId: string;
  email: string;
  inviteLink: string;
}

export function InviteActionButtons({ inviteId, email, inviteLink }: InviteActionButtonsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"resend" | "delete" | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  }

  async function handleResend() {
    setLoading("resend");
    const result = await resendInvite(inviteId);
    setLoading(null);
    if (result.success) router.refresh();
  }

  async function handleDelete() {
    setConfirmOpen(false);
    setLoading("delete");
    await deleteInvite(inviteId);
    setLoading(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={handleCopyLink}
          title={inviteLink}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary"
        >
          {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          {copied ? "Copiado!" : "Copiar link"}
        </button>
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
          onClick={() => setConfirmOpen(true)}
          className="text-xs text-destructive hover:text-destructive/80 transition-colors px-2 py-1 rounded hover:bg-destructive/10 disabled:opacity-50"
        >
          {loading === "delete" ? "..." : "Cancelar"}
        </button>
      </div>
      <ConfirmModal
        open={confirmOpen}
        title="Cancelar convite?"
        description={`O convite enviado para ${email} será invalidado permanentemente.`}
        confirmLabel="Cancelar convite"
        isPending={loading === "delete"}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
