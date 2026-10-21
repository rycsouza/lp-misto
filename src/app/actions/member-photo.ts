"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getCustomerAccount } from "@/lib/accounts/session";
import { checkModuleAccess } from "@/lib/admin/auth-guard";
import { logAudit } from "@/lib/audit";
import { getCurrentTenantSlug } from "@/lib/base-url";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import { rateLimit } from "@/lib/ratelimit";
import { findMemberByAccountEmail } from "@/lib/membership/my-member";
import { MEMBER_PHOTO_RATE, safeMemberPhotoUrl } from "@/lib/membership/member-photo";
import { removeStoredMemberPhoto } from "@/lib/membership/member-photo-service";

/**
 * Foto de perfil do sócio: leitura e remoção pela área logada (sempre no sócio do e-mail
 * da sessão) e remoção pelo admin (módulo socios). Só funções assíncronas exportadas.
 * O envio fica na rota POST /api/conta/foto.
 */

/** Foto do sócio logado, já validada (URL do Cloudinary do projeto ou null). */
export async function getMyPhoto(): Promise<{ ok: true; photoUrl: string | null } | { ok: false }> {
  const me = await getCustomerAccount();
  if (!me) return { ok: false };
  const member = await findMemberByAccountEmail(me.email);
  if (!member) return { ok: true, photoUrl: null };
  return { ok: true, photoUrl: safeMemberPhotoUrl(member.photoUrl, process.env.CLOUDINARY_CLOUD_NAME) };
}

/** Remove a foto do próprio sócio (sessão obrigatória; mesmo limite das trocas). */
export async function removeMyPhoto(): Promise<{ ok: boolean; error?: string }> {
  const me = await getCustomerAccount();
  if (!me) return { ok: false, error: "Sua sessão expirou. Entre novamente." };

  const limit = await rateLimit(`rl:conta-foto:${me.id}`, MEMBER_PHOTO_RATE.limit, MEMBER_PHOTO_RATE.windowSec);
  if (!limit.ok) return { ok: false, error: "Muitas alterações de foto. Tente de novo mais tarde." };

  const member = await findMemberByAccountEmail(me.email);
  if (!member) return { ok: false, error: "Você ainda não é sócio com o e-mail desta conta." };
  if (!member.photoUrl && !member.photoPublicId) return { ok: true };

  try {
    await removeStoredMemberPhoto({
      memberId: member.id,
      tenantSlug: await getCurrentTenantSlug(),
      previousPublicId: member.photoPublicId,
    });
    return { ok: true };
  } catch (err) {
    console.error("[foto-socio] falha ao remover a própria foto:", err instanceof Error ? err.name : "erro");
    return { ok: false, error: "Não foi possível remover a foto agora. Tente de novo." };
  }
}

/**
 * Moderação: tira a foto do sócio (ex.: imprópria). Guarda do módulo socios com kill-switch
 * (admin, ou editor com a permissão). Auditado só com o id do sócio.
 */
export async function removeMemberPhotoAdmin(memberId: string): Promise<{ success: boolean; error?: string }> {
  const access = await checkModuleAccess("socios");
  if ("error" in access) return { success: false, error: access.error };
  if (!z.string().uuid().safeParse(memberId).success) return { success: false, error: "Sócio inválido." };

  const db = await getDb();
  const [m] = await db
    .select({ id: members.id, photoPublicId: members.photoPublicId })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);
  if (!m) return { success: false, error: "Sócio não encontrado." };

  try {
    await removeStoredMemberPhoto({
      memberId,
      tenantSlug: await getCurrentTenantSlug(),
      previousPublicId: m.photoPublicId,
    });
  } catch (err) {
    console.error("[foto-socio] falha ao remover foto (admin):", err instanceof Error ? err.name : "erro");
    return { success: false, error: "Não foi possível remover a foto agora." };
  }
  await logAudit("member_photo_remove", "member", memberId);
  revalidatePath(`/admin/socios/${memberId}`);
  return { success: true };
}
