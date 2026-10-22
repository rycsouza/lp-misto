import { getCustomerAccount } from "@/lib/accounts/session";
import { getCurrentTenantSlug } from "@/lib/base-url";
import { rateLimit } from "@/lib/ratelimit";
import { findMemberByAccountEmail } from "@/lib/membership/my-member";
import { isMemberPhotoType, MEMBER_PHOTO_MAX_BYTES, MEMBER_PHOTO_RATE } from "@/lib/membership/member-photo";
import { memberLogoFolder, sniffMemberLogoType } from "@/lib/membership/member-logo";
import { storeMemberLogo } from "@/lib/membership/member-logo-service";
import { fromSameHost, readBodyCapped, replyNoStore as reply } from "@/lib/membership/upload-request";

/**
 * Logo da empresa do sócio, enviado pelo PRÓPRIO sócio logado. Só para sócio de plano
 * EMPRESARIAL ('pj'): o público vem do plano atual, lido no servidor. O id nunca vem do cliente.
 *
 * Mesmas defesas da foto (POST /api/conta/foto): origem → sessão → sócio → plano → limite de
 * trocas (contador compartilhado com a foto) → tamanho do corpo → arquivo → magic bytes →
 * gravação. Respostas sempre `{ ok, ... }`, sem detalhe interno.
 */

export const runtime = "nodejs";

const BODY_OVERHEAD_BYTES = 64 * 1024;
const BODY_MAX_BYTES = MEMBER_PHOTO_MAX_BYTES + BODY_OVERHEAD_BYTES;

export async function POST(request: Request) {
  if (!fromSameHost(request)) {
    return reply(403, { ok: false, error: "Não foi possível enviar o logo." });
  }

  const account = await getCustomerAccount();
  if (!account) {
    return reply(401, { ok: false, error: "Sua sessão expirou. Entre novamente." });
  }

  const member = await findMemberByAccountEmail(account.email);
  if (!member) {
    return reply(403, { ok: false, error: "Você ainda não é sócio com o e-mail desta conta." });
  }
  if (member.planAudience !== "pj") {
    return reply(403, { ok: false, error: "Logo é só para planos empresariais." });
  }

  // Mesmo teto da foto (contador por conta): trocar foto e logo juntas não burla o limite.
  const limit = await rateLimit(`rl:conta-foto:${account.id}`, MEMBER_PHOTO_RATE.limit, MEMBER_PHOTO_RATE.windowSec);
  if (!limit.ok) {
    return reply(429, { ok: false, error: "Muitas alterações de imagem. Tente de novo mais tarde." });
  }

  const tenantSlug = await getCurrentTenantSlug();
  if (!memberLogoFolder(tenantSlug)) {
    return reply(500, { ok: false, error: "Não foi possível enviar o logo agora." });
  }

  const raw = await readBodyCapped(request, BODY_MAX_BYTES);
  if (raw === "too_large") {
    return reply(413, { ok: false, error: "O logo deve ter no máximo 5 MB." });
  }
  if (raw === null) {
    return reply(400, { ok: false, error: "Nenhum logo enviado." });
  }

  let form: FormData;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    form = await new Response(raw, { headers: { "content-type": contentType } }).formData();
  } catch {
    return reply(400, { ok: false, error: "Envio inválido." });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return reply(400, { ok: false, error: "Nenhum logo enviado." });
  }
  if (file.size > MEMBER_PHOTO_MAX_BYTES) {
    return reply(413, { ok: false, error: "O logo deve ter no máximo 5 MB." });
  }

  // O tipo vale só se o MIME declarado for da allowlist E os bytes forem do mesmo tipo.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffMemberLogoType(bytes);
  if (!sniffed || !isMemberPhotoType(file.type) || file.type !== sniffed) {
    return reply(415, { ok: false, error: "Formato não aceito. Envie um logo em JPEG, PNG ou WebP." });
  }

  const result = await storeMemberLogo({
    memberId: member.id,
    tenantSlug,
    bytes,
    type: sniffed,
    previousPublicId: member.logoPublicId,
  });
  if (!result.ok) {
    return reply(500, { ok: false, error: "Não foi possível salvar o logo agora. Tente de novo." });
  }
  return reply(200, { ok: true, logoUrl: result.logoUrl });
}
