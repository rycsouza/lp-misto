/**
 * Logo da empresa do sócio (plano empresarial, CNPJ): regras PURAS (sem I/O, sem módulos de
 * servidor). Servem ao servidor (upload, validação ao gravar e ao ler) e à tela (validação de
 * `src` antes de renderizar). Os limites de tamanho, o sniff de magic bytes e o limite de
 * trocas são os da foto (member-photo.ts), para as duas imagens do sócio seguirem a mesma regra.
 *
 * Diferenças da foto:
 * - sem recorte de rosto: `c_pad` encaixa o logo inteiro num quadrado de 512 px;
 * - fundo TRANSPARENTE (`b_transparent`) e saída em PNG: o logo mantém a transparência;
 * - pasta `<clube>/socios/logos` (nunca a de fotos) e URL validada com a transformação de logo.
 *
 * Segurança: só a URL de entrega do PROJETO passa (https, res.cloudinary.com, sem credenciais,
 * porta, query ou fragmento, cloud do projeto, transformação exata e public_id de logo de sócio).
 */
import { isValidCloudName, sniffMemberPhotoType, type MemberPhotoType } from "@/lib/membership/member-photo";

/**
 * Transformação de ENTREGA: encaixa o logo inteiro em 512 px quadrados, com fundo transparente.
 * `f_auto` escolhe o formato de entrega sem perder o canal alpha. Ver MEMBER_LOGO_UPLOAD_TRANSFORM_PARAMS.
 */
export const MEMBER_LOGO_TRANSFORM = "c_pad,w_512,h_512,b_transparent,q_auto,f_auto";

/**
 * Transformação aplicada JÁ NO UPLOAD (o arquivo guardado é o logo encaixado). Como na foto,
 * vai como OBJETO/array de parâmetros: string em `transformation` vira nome de transformação salva.
 */
export const MEMBER_LOGO_UPLOAD_TRANSFORM_PARAMS = [
  { crop: "pad", width: 512, height: 512, background: "transparent" },
] as const;

/** Formato guardado no Cloudinary: PNG mantém a transparência (JPEG não tem alpha). */
export const MEMBER_LOGO_UPLOAD_FORMAT = "png" as const;

const CLOUDINARY_ORIGIN = "https://res.cloudinary.com";
const TENANT_RE = /^[a-z0-9-]{1,40}$/;
/** `<clube>/socios/logos/<id>`: só o que o próprio upload gera. */
const PUBLIC_ID_RE = /^[a-z0-9-]{1,40}\/socios\/logos\/[A-Za-z0-9_-]{1,64}$/;
const URL_MAX_CHARS = 512;
const URL_SAFE_CHARS_RE = /^https:\/\/[^\s"'<>\\`]+$/;

/**
 * Pasta de upload do logo do clube: `<slug>/socios/logos`. Sem slug utilizável devolve null:
 * o logo nunca vai para uma pasta sem clube.
 */
export function memberLogoFolder(tenantSlug: string | null | undefined): string | null {
  if (!tenantSlug) return null;
  const slug = tenantSlug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!TENANT_RE.test(slug)) return null;
  return `${slug}/socios/logos`;
}

/** O public_id é de logo de sócio DESTE clube (usado antes de apagar no Cloudinary). */
export function isMemberLogoPublicIdFor(publicId: string | null | undefined, tenantSlug: string | null | undefined): boolean {
  const folder = memberLogoFolder(tenantSlug);
  if (!folder || typeof publicId !== "string") return false;
  return PUBLIC_ID_RE.test(publicId) && publicId.startsWith(`${folder}/`);
}

/** Tipo real do logo pelos bytes (JPEG, PNG ou WebP). Qualquer outra coisa: null. */
export function sniffMemberLogoType(bytes: Uint8Array): MemberPhotoType | null {
  return sniffMemberPhotoType(bytes);
}

/**
 * URL de ENTREGA gravada no banco. Lança se o cloud ou o public_id estiverem fora do formato
 * esperado (só acontece com dado corrompido; quem chama trata como falha).
 */
export function memberLogoDeliveryUrl(cloudName: string, publicId: string): string {
  if (!isValidCloudName(cloudName)) throw new Error("cloud inválido");
  if (!PUBLIC_ID_RE.test(publicId)) throw new Error("public_id inválido");
  return `${CLOUDINARY_ORIGIN}/${cloudName}/image/upload/${MEMBER_LOGO_TRANSFORM}/${publicId}`;
}

/**
 * logoUrl só se for a URL de entrega de logo do PROJETO (mesmas regras de host, protocolo,
 * credenciais, porta, query e fragmento da foto; transformação e pasta de LOGO). Qualquer
 * outra coisa, inclusive URL de foto de sócio, vira null.
 */
export function safeMemberLogoUrl(value: unknown, cloudName: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length > URL_MAX_CHARS) return null;
  if (!isValidCloudName(cloudName)) return null;
  if (!URL_SAFE_CHARS_RE.test(value)) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.origin !== CLOUDINARY_ORIGIN) return null;
  if (parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) return null;

  const prefix = `/${cloudName}/image/upload/${MEMBER_LOGO_TRANSFORM}/`;
  if (!parsed.pathname.startsWith(prefix)) return null;
  if (!PUBLIC_ID_RE.test(parsed.pathname.slice(prefix.length))) return null;
  return value;
}

/**
 * Checagem final antes de pôr a URL em `<img src>` (a tela não conhece o cloud name): só o
 * formato da URL de entrega de logo de sócio. Quem busca no banco já a validou com `safeMemberLogoUrl`.
 */
const RENDERABLE_LOGO_RE =
  /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]{1,64}\/image\/upload\/c_pad,w_512,h_512,b_transparent,q_auto,f_auto\/[a-z0-9-]{1,40}\/socios\/logos\/[A-Za-z0-9_-]{1,64}$/;

export function isRenderableMemberLogoSrc(value: unknown): value is string {
  return typeof value === "string" && value.length <= URL_MAX_CHARS && RENDERABLE_LOGO_RE.test(value);
}
