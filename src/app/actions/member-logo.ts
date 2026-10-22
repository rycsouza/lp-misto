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
import { MEMBER_PHOTO_RATE } from "@/lib/membership/member-photo";
import { safeMemberLogoUrl } from "@/lib/membership/member-logo";
import { removeStoredMemberLogo } from "@/lib/membership/member-logo-service";

/**
 * Logo da empresa do sócio: leitura e remoção pela área logada (sempre no sócio do e-mail da
 * sessão) e remoção pelo admin (módulo socios). Só funções assíncronas exportadas.
 * O envio fica na rota POST /api/conta/logo (só plano empresarial, 'pj').
 */

/**
 * Logo do sócio logado. `canHaveLogo` vem do público do PLANO atual: só o plano empresarial
 * mostra e recebe logo. Para pessoa física, `logoUrl` é sempre null.
 */
export async function getMyLogo(): Promise<
  { ok: true; canHaveLogo: boolean; logoUrl: string | null } | { ok: false }
> {
  const me = await getCustomerAccount();
  if (!me) return { ok: false };
  const member = await findMemberByAccountEmail(me.email);
  if (!member) return { ok: true, canHaveLogo: false, logoUrl: null };
  const canHaveLogo = member.planAudience === "pj";
  return {
    ok: true,
    canHaveLogo,
    logoUrl: canHaveLogo ? safeMemberLogoUrl(member.logoUrl, process.env.CLOUDINARY_CLOUD_NAME) : null,
  };
}

/** Remove o logo do próprio sócio (sessão obrigatória; mesmo limite das trocas de imagem). */
export async function removeMyLogo(): Promise<{ ok: boolean; error?: string }> {
  const me = await getCustomerAccount();
  if (!me) return { ok: false, error: "Sua sessão expirou. Entre novamente." };

  const limit = await rateLimit(`rl:conta-foto:${me.id}`, MEMBER_PHOTO_RATE.limit, MEMBER_PHOTO_RATE.windowSec);
  if (!limit.ok) return { ok: false, error: "Muitas alterações de imagem. Tente de novo mais tarde." };

  const member = await findMemberByAccountEmail(me.email);
  if (!member) return { ok: false, error: "Você ainda não é sócio com o e-mail desta conta." };
  if (!member.logoUrl && !member.logoPublicId) return { ok: true };

  try {
    await removeStoredMemberLogo({
      memberId: member.id,
      tenantSlug: await getCurrentTenantSlug(),
      previousPublicId: member.logoPublicId,
    });
    return { ok: true };
  } catch (err) {
    console.error("[logo-socio] falha ao remover o próprio logo:", err instanceof Error ? err.name : "erro");
    return { ok: false, error: "Não foi possível remover o logo agora. Tente de novo." };
  }
}

/**
 * Moderação: tira o logo da empresa do sócio. Guarda do módulo socios (admin, ou editor com a
 * permissão) e kill-switch do clube. Auditado só com o id do sócio.
 */
export async function removeMemberLogoAdmin(memberId: string): Promise<{ success: boolean; error?: string }> {
  const access = await checkModuleAccess("socios");
  if ("error" in access) return { success: false, error: access.error };
  if (!z.string().uuid().safeParse(memberId).success) return { success: false, error: "Sócio inválido." };

  const db = await getDb();
  const [m] = await db
    .select({ id: members.id, logoPublicId: members.logoPublicId })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);
  if (!m) return { success: false, error: "Sócio não encontrado." };

  try {
    await removeStoredMemberLogo({
      memberId,
      tenantSlug: await getCurrentTenantSlug(),
      previousPublicId: m.logoPublicId,
    });
  } catch (err) {
    console.error("[logo-socio] falha ao remover logo (admin):", err instanceof Error ? err.name : "erro");
    return { success: false, error: "Não foi possível remover o logo agora." };
  }
  await logAudit("member_logo_remove", "member", memberId);
  revalidatePath(`/admin/socios/${memberId}`);
  return { success: true };
}
