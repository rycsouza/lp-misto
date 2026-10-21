import { v2 as cloudinary } from "cloudinary";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import {
  isMemberPhotoPublicIdFor,
  isValidCloudName,
  MEMBER_PHOTO_UPLOAD_TRANSFORM_PARAMS,
  memberPhotoDeliveryUrl,
  memberPhotoFolder,
  type MemberPhotoType,
} from "@/lib/membership/member-photo";

/**
 * Armazenamento da foto de sócio no Cloudinary + gravação no banco. Só servidor.
 * Falhas são devolvidas como `ok: false` (sem detalhe): o Cloudinary e o banco nunca
 * chegam ao cliente. Detalhes técnicos vão só para o log, sem o conteúdo do arquivo.
 */

export type StoreMemberPhotoResult = { ok: true; photoUrl: string } | { ok: false };

/**
 * Log sem conteúdo do arquivo nem dados do sócio. O SDK do Cloudinary rejeita com um
 * OBJETO ({ message, http_code } ou { error: {...} }), não com Error — por isso lemos os
 * dois formatos; a mensagem do Cloudinary é técnica (sem dado pessoal) e vai truncada.
 */
function logError(context: string, err: unknown): void {
  const e = (err && typeof err === "object" && "error" in err ? (err as { error: unknown }).error : err) as
    | { name?: unknown; message?: unknown; http_code?: unknown }
    | null
    | undefined;
  const name = err instanceof Error ? err.name : typeof e?.name === "string" ? e.name : "erro";
  const code = typeof e?.http_code === "number" ? ` http=${e.http_code}` : "";
  const msg = typeof e?.message === "string" ? ` msg=${e.message.slice(0, 160)}` : "";
  console.error(`[foto-socio] ${context}: ${name}${code}${msg}`);
}

/** Configura o SDK com as credenciais do ambiente. Null se faltar qualquer uma. */
function configuredCloud(): { cloudName: string } | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!isValidCloudName(cloudName) || !apiKey || !apiSecret) return null;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return { cloudName };
}

/** Apaga no Cloudinary, só se o public_id for de foto de sócio deste clube. Erro só no log. */
async function destroyMemberPhoto(publicId: string, tenantSlug: string | null): Promise<void> {
  if (!isMemberPhotoPublicIdFor(publicId, tenantSlug)) {
    logError("public_id fora da pasta do clube (não apagado)", new Error("public_id"));
    return;
  }
  if (!configuredCloud()) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image", type: "upload", invalidate: true });
  } catch (err) {
    logError("falha ao apagar foto antiga", err);
  }
}

/**
 * Sobe a foto nova para `<clube>/socios/fotos` (já recortada no upload), grava a URL de
 * entrega e o public_id, e apaga a foto anterior. Se o banco falhar, apaga a recém-enviada
 * para não deixar órfã. Os bytes já foram validados pela rota (tamanho e magic bytes).
 */
export async function storeMemberPhoto(input: {
  memberId: string;
  tenantSlug: string | null;
  bytes: Uint8Array;
  type: MemberPhotoType;
  previousPublicId: string | null;
}): Promise<StoreMemberPhotoResult> {
  const cfg = configuredCloud();
  const folder = memberPhotoFolder(input.tenantSlug);
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
      transformation: MEMBER_PHOTO_UPLOAD_TRANSFORM_PARAMS.map((t) => ({ ...t })),
    });
    publicId = uploaded.public_id;
  } catch (err) {
    logError("falha no upload", err);
    return { ok: false };
  }

  let photoUrl: string;
  try {
    photoUrl = memberPhotoDeliveryUrl(cfg.cloudName, publicId);
  } catch (err) {
    logError("URL de entrega inválida", err);
    await destroyMemberPhoto(publicId, input.tenantSlug);
    return { ok: false };
  }

  // Grava SÓ se a foto guardada ainda for a que foi lida (envios simultâneos: quem perde
  // apaga o próprio upload, sem órfão e sem apagar a foto de quem ganhou).
  let saved = false;
  try {
    const db = await getDb();
    const current = input.previousPublicId
      ? eq(members.photoPublicId, input.previousPublicId)
      : isNull(members.photoPublicId);
    const rows = await db
      .update(members)
      .set({ photoUrl, photoPublicId: publicId, updatedAt: new Date() })
      .where(and(eq(members.id, input.memberId), current))
      .returning({ id: members.id });
    saved = rows.length === 1;
  } catch (err) {
    logError("falha ao gravar a foto", err);
  }
  if (!saved) {
    await destroyMemberPhoto(publicId, input.tenantSlug);
    return { ok: false };
  }

  if (input.previousPublicId && input.previousPublicId !== publicId) {
    await destroyMemberPhoto(input.previousPublicId, input.tenantSlug);
  }
  return { ok: true, photoUrl };
}

/** Remove a foto do sócio: zera as colunas e apaga o arquivo anterior no Cloudinary. */
export async function removeStoredMemberPhoto(input: {
  memberId: string;
  tenantSlug: string | null;
  previousPublicId: string | null;
}): Promise<void> {
  const db = await getDb();
  await db
    .update(members)
    .set({ photoUrl: null, photoPublicId: null, updatedAt: new Date() })
    .where(eq(members.id, input.memberId));
  if (input.previousPublicId) await destroyMemberPhoto(input.previousPublicId, input.tenantSlug);
}
