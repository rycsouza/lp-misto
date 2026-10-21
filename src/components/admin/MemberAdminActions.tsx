"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, XCircle, BadgeCheck, EyeOff, RefreshCw, ImageOff } from "lucide-react";
import {
  activateMemberById,
  cancelMemberAdmin,
  regenerateMemberCardAdmin,
  removeMemberFromWallAdmin,
  resendMemberCardAdmin,
} from "@/app/actions/membership";
import { removeMemberPhotoAdmin } from "@/app/actions/member-photo";
import { MemberSyncButton } from "@/components/admin/MemberSyncButton";

type Confirm = "cancel" | "activate" | "wall" | "card" | "photo" | null;

/** Ações do sócio no admin. Cancelar/ativar manualmente: só perfil admin. */
export function MemberAdminActions({
  memberId,
  status,
  hasSubscription,
  isAdmin,
  wallName,
  photoUrl,
}: {
  memberId: string;
  status: string;
  hasSubscription: boolean;
  isAdmin: boolean;
  /** Nome no Mural dos Sócios (null = não aparece). */
  wallName: string | null;
  /** Foto de perfil (null = sem foto). */
  photoUrl: string | null;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; text: string }>) {
    setMessage(null);
    startTransition(async () => {
      const r = await fn().catch(() => ({ ok: false, text: "Não foi possível concluir agora." }));
      setMessage(r);
      setConfirm(null);
      if (r.ok) router.refresh();
    });
  }

  const btn =
    "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-border hover:bg-secondary transition-colors disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {hasSubscription && status !== "cancelled" && (
          <span className="inline-flex items-center px-3 py-2 rounded-lg border border-border">
            <MemberSyncButton memberId={memberId} />
          </span>
        )}
        <button
          type="button"
          disabled={isPending}
          className={btn}
          onClick={() =>
            run(async () => {
              const r = await resendMemberCardAdmin(memberId);
              return r.success
                ? { ok: true, text: "Link da carteirinha enviado ao e-mail do sócio." }
                : { ok: false, text: r.error ?? "Falha ao enviar." };
            })
          }
        >
          <Mail size={14} /> Reenviar carteirinha
        </button>
        <button type="button" disabled={isPending} className={btn} onClick={() => setConfirm("card")}>
          <RefreshCw size={14} /> Gerar nova carteirinha
        </button>
        {wallName && (
          <button type="button" disabled={isPending} className={btn} onClick={() => setConfirm("wall")}>
            <EyeOff size={14} /> Remover do mural
          </button>
        )}
        {photoUrl && (
          <button type="button" disabled={isPending} className={btn} onClick={() => setConfirm("photo")}>
            <ImageOff size={14} /> Remover foto
          </button>
        )}
        {isAdmin && status !== "active" && (
          <button type="button" disabled={isPending} className={btn} onClick={() => setConfirm("activate")}>
            <BadgeCheck size={14} /> Ativar manualmente
          </button>
        )}
        {isAdmin && status !== "cancelled" && (
          <button
            type="button"
            disabled={isPending}
            className={`${btn} text-destructive`}
            onClick={() => setConfirm("cancel")}
          >
            <XCircle size={14} /> Cancelar assinatura
          </button>
        )}
      </div>

      {confirm && (
        <div className="p-3 rounded-lg border border-border bg-secondary/30 text-sm">
          <p className="text-foreground mb-2">
            {confirm === "cancel"
              ? "Cancelar a assinatura? A cobrança para no gateway e os benefícios seguem até o fim do período já pago."
              : confirm === "wall"
              ? "Remover o nome do Mural dos Sócios? Ele some do site na hora. Fica registrado na auditoria."
              : confirm === "photo"
              ? "Remover a foto de perfil do sócio? Ela some do site na hora. Fica registrado na auditoria."
              : confirm === "card"
              ? "Gerar nova carteirinha? O QR e o link antigos param de funcionar na hora, inclusive prints e o passe da Google Carteira. O sócio precisa receber a nova. Fica registrado na auditoria."
              : "Ativar manualmente (cortesia/acerto)? O sócio fica ativo por 30 dias SEM cobrança no gateway. Fica registrado na auditoria."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              className={`${btn} ${confirm === "cancel" ? "text-destructive" : ""}`}
              onClick={() =>
                run(async () => {
                  if (confirm === "cancel") {
                    const r = await cancelMemberAdmin(memberId);
                    return r.success
                      ? { ok: true, text: "Assinatura cancelada." }
                      : { ok: false, text: r.error ?? "Falha ao cancelar." };
                  }
                  if (confirm === "wall") {
                    const r = await removeMemberFromWallAdmin(memberId);
                    return r.success
                      ? { ok: true, text: "Nome removido do mural." }
                      : { ok: false, text: r.error ?? "Falha ao remover do mural." };
                  }
                  if (confirm === "photo") {
                    const r = await removeMemberPhotoAdmin(memberId);
                    return r.success
                      ? { ok: true, text: "Foto removida." }
                      : { ok: false, text: r.error ?? "Falha ao remover a foto." };
                  }
                  if (confirm === "card") {
                    const r = await regenerateMemberCardAdmin(memberId);
                    return r.success
                      ? { ok: true, text: "Nova carteirinha gerada. O QR antigo não funciona mais." }
                      : { ok: false, text: r.error ?? "Falha ao gerar a nova carteirinha." };
                  }
                  await activateMemberById(memberId);
                  return { ok: true, text: "Sócio ativado manualmente." };
                })
              }
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              Confirmar
            </button>
            <button type="button" className={btn} onClick={() => setConfirm(null)}>
              Voltar
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`text-sm ${message.ok ? "text-green-600" : "text-destructive"}`}>{message.text}</p>
      )}
    </div>
  );
}
