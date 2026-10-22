import { getCustomerAccount } from "@/lib/accounts/session";
import { getCurrentTenantSlug } from "@/lib/base-url";
import { rateLimit } from "@/lib/ratelimit";
import { findMemberByAccountEmail } from "@/lib/membership/my-member";
import {
  isMemberPhotoType,
  MEMBER_PHOTO_MAX_BYTES,
  MEMBER_PHOTO_RATE,
  memberPhotoFolder,
  sniffMemberPhotoType,
} from "@/lib/membership/member-photo";
import { storeMemberPhoto } from "@/lib/membership/member-photo-service";
import { fromSameHost, readBodyCapped, replyNoStore as reply } from "@/lib/membership/upload-request";

/**
 * Foto de perfil do sócio, enviada pelo PRÓPRIO sócio logado. Só mexe no sócio do e-mail
 * da sessão (o id nunca vem do cliente). Campos extras do formulário são ignorados.
 *
 * Ordem: origem → sessão → sócio → limite de envios → tamanho do corpo → arquivo →
 * magic bytes → gravação. Respostas sempre `{ ok, ... }`, sem detalhe interno.
 */

export const runtime = "nodejs";

/** Folga para as bordas do multipart, além do arquivo em si. */
const BODY_OVERHEAD_BYTES = 64 * 1024;
const BODY_MAX_BYTES = MEMBER_PHOTO_MAX_BYTES + BODY_OVERHEAD_BYTES;

export async function POST(request: Request) {
  if (!fromSameHost(request)) {
    return reply(403, { ok: false, error: "Não foi possível enviar a foto." });
  }

  const account = await getCustomerAccount();
  if (!account) {
    return reply(401, { ok: false, error: "Sua sessão expirou. Entre novamente." });
  }

  const member = await findMemberByAccountEmail(account.email);
  if (!member) {
    return reply(403, { ok: false, error: "Você ainda não é sócio com o e-mail desta conta." });
  }

  const limit = await rateLimit(`rl:conta-foto:${account.id}`, MEMBER_PHOTO_RATE.limit, MEMBER_PHOTO_RATE.windowSec);
  if (!limit.ok) {
    return reply(429, { ok: false, error: "Muitas alterações de foto. Tente de novo mais tarde." });
  }

  const tenantSlug = await getCurrentTenantSlug();
  if (!memberPhotoFolder(tenantSlug)) {
    return reply(500, { ok: false, error: "Não foi possível enviar a foto agora." });
  }

  const raw = await readBodyCapped(request, BODY_MAX_BYTES);
  if (raw === "too_large") {
    return reply(413, { ok: false, error: "A foto deve ter no máximo 5 MB." });
  }
  if (raw === null) {
    return reply(400, { ok: false, error: "Nenhuma foto enviada." });
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
    return reply(400, { ok: false, error: "Nenhuma foto enviada." });
  }
  if (file.size > MEMBER_PHOTO_MAX_BYTES) {
    return reply(413, { ok: false, error: "A foto deve ter no máximo 5 MB." });
  }

  // O tipo vale só se o MIME declarado for da allowlist E os bytes forem do mesmo tipo.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffMemberPhotoType(bytes);
  if (!sniffed || !isMemberPhotoType(file.type) || file.type !== sniffed) {
    return reply(415, { ok: false, error: "Formato não aceito. Envie uma foto em JPEG, PNG ou WebP." });
  }

  const result = await storeMemberPhoto({
    memberId: member.id,
    tenantSlug,
    bytes,
    type: sniffed,
    previousPublicId: member.photoPublicId,
  });
  if (!result.ok) {
    return reply(500, { ok: false, error: "Não foi possível salvar a foto agora. Tente de novo." });
  }
  return reply(200, { ok: true, photoUrl: result.photoUrl });
}
