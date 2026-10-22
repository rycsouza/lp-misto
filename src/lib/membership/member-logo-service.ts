import { v2 as cloudinary } from "cloudinary";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import { isValidCloudName, type MemberPhotoType } from "@/lib/membership/member-photo";
import {
  isMemberLogoPublicIdFor,
  MEMBER_LOGO_UPLOAD_FORMAT,
  MEMBER_LOGO_UPLOAD_TRANSFORM_PARAMS,
  memberLogoDeliveryUrl,
  memberLogoFolder,
} from "@/lib/membership/member-logo";

/**
 * Armazenamento do logo da empresa do sócio no Cloudinary + gravação no banco. Só servidor.
 * Espelha member-photo-service.ts: falhas viram `ok: false` (sem detalhe), e o log nunca
 * tem o conteúdo do arquivo nem dado do sócio.
 */

export type StoreMemberLogoResult = { ok: true; logoUrl: string } | { ok: false };

function logError(context: string, err: unknown): void {
  const e = (err && typeof err === "object" && "error" in err ? (err as { error: unknown }).error : err) as
    | { name?: unknown; message?: unknown; http_code?: unknown }
    | null
    | undefined;
  const name = err instanceof Error ? err.name : typeof e?.name === "string" ? e.name : "erro";
  const code = typeof e?.http_code === "number" ? ` http=${e.http_code}` : "";
  const msg = typeof e?.message === "string" ? ` msg=${e.message.slice(0, 160)}` : "";
  console.error(`[logo-socio] ${context}: ${name}${code}${msg}`);
}

function configuredCloud(): { cloudName: string } | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!isValidCloudName(cloudName) || !apiKey || !apiSecret) return null;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return { cloudName };
}

/** Apaga no Cloudinary, só se o public_id for de logo de sócio deste clube. Erro só no log. */
async function destroyMemberLogo(publicId: string, tenantSlug: string | null): Promise<void> {
  if (!isMemberLogoPublicIdFor(publicId, tenantSlug)) {
    logError("public_id fora da pasta do clube (não apagado)", new Error("public_id"));
    return;
  }
  if (!configuredCloud()) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image", type: "upload", invalidate: true });
  } catch (err) {
    logError("falha ao apagar logo antigo", err);
  }
}

/**
 * Sobe o logo novo para `<clube>/socios/logos` (encaixado em 512 px, fundo transparente, PNG),
 * grava a URL de entrega e o public_id e apaga o logo anterior. Se o banco falhar, apaga o
 * recém-enviado para não deixar órfão. Os bytes já foram validados pela rota.
 */
export async function storeMemberLogo(input: {
  memberId: string;
  tenantSlug: string | null;
  bytes: Uint8Array;
  type: MemberPhotoType;
  previousPublicId: string | null;
}): Promise<StoreMemberLogoResult> {
  const cfg = configuredCloud();
  const folder = memberLogoFolder(input.tenantSlug);
  if (!cfg || !folder) return { ok: false };

  let publicId: string;
  try {
    const dataUri = `data:${input.type};base64,${Buffer.from(input.bytes).toString("base64")}`;
    const uploaded = await cloudinary.uploader.upload(dataUri, {
      folder,
      resource_type: "image",
      type: "upload",
      use_filename: false,
      unique_filename: true,
      overwrite: false,
      format: MEMBER_LOGO_UPLOAD_FORMAT,
      transformation: MEMBER_LOGO_UPLOAD_TRANSFORM_PARAMS.map((t) => ({ ...t })),
    });
    publicId = uploaded.public_id;
  } catch (err) {
    logError("falha no upload", err);
    return { ok: false };
  }

  let logoUrl: string;
  try {
    logoUrl = memberLogoDeliveryUrl(cfg.cloudName, publicId);
  } catch (err) {
    logError("URL de entrega inválida", err);
    await destroyMemberLogo(publicId, input.tenantSlug);
    return { ok: false };
  }

  // Grava SÓ se o logo guardado ainda for o que foi lido (envios simultâneos: quem perde
  // apaga o próprio upload, sem órfão e sem apagar o logo de quem ganhou).
  let saved = false;
  try {
    const db = await getDb();
    const current = input.previousPublicId
      ? eq(members.logoPublicId, input.previousPublicId)
      : isNull(members.logoPublicId);
    const rows = await db
      .update(members)
      .set({ logoUrl, logoPublicId: publicId, updatedAt: new Date() })
      .where(and(eq(members.id, input.memberId), current))
      .returning({ id: members.id });
    saved = rows.length === 1;
  } catch (err) {
    logError("falha ao gravar o logo", err);
  }
  if (!saved) {
    await destroyMemberLogo(publicId, input.tenantSlug);
    return { ok: false };
  }

  if (input.previousPublicId && input.previousPublicId !== publicId) {
    await destroyMemberLogo(input.previousPublicId, input.tenantSlug);
  }
  return { ok: true, logoUrl };
}

/** Remove o logo do sócio: zera as colunas e apaga o arquivo anterior no Cloudinary. */
export async function removeStoredMemberLogo(input: {
  memberId: string;
  tenantSlug: string | null;
  previousPublicId: string | null;
}): Promise<void> {
  const db = await getDb();
  await db
    .update(members)
    .set({ logoUrl: null, logoPublicId: null, updatedAt: new Date() })
    .where(eq(members.id, input.memberId));
  if (input.previousPublicId) await destroyMemberLogo(input.previousPublicId, input.tenantSlug);
}
