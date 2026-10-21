/**
 * Foto de perfil do sócio: regras PURAS (sem I/O, sem módulos de servidor). Servem ao
 * servidor (upload, validação ao gravar e ao ler) e ao cliente (pré-checagem do arquivo
 * e validação de `src` antes de renderizar).
 *
 * Segurança:
 * - o tipo real do arquivo vem dos MAGIC BYTES (`sniffMemberPhotoType`), não do MIME do
 *   cliente; SVG, GIF e HTML ficam de fora da allowlist;
 * - a URL exibida só passa se for https do Cloudinary do PROJETO, com a transformação de
 *   entrega e uma pasta de sócios (`<clube>/socios/fotos/<id>`). Nunca se renderiza URL
 *   arbitrária vinda do banco ou do cliente.
 */

/** Tamanho máximo do arquivo enviado (5 MB). */
export const MEMBER_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const MEMBER_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type MemberPhotoType = (typeof MEMBER_PHOTO_TYPES)[number];

/** Valor do `accept` do input de arquivo (mesma allowlist). */
export const MEMBER_PHOTO_ACCEPT = MEMBER_PHOTO_TYPES.join(",");

/**
 * Transformação de ENTREGA: quadrada (512 px), recortada no rosto, com compressão e formato
 * automáticos. Não há flag que preserve metadados: transformações do Cloudinary descartam
 * EXIF/GPS do original. Esta string também é a que a URL gravada carrega.
 */
export const MEMBER_PHOTO_TRANSFORM = "c_fill,g_face,w_512,h_512,q_auto,f_auto";

/**
 * Transformação aplicada JÁ NO UPLOAD (o arquivo guardado no Cloudinary é o recorte, sem o
 * original com metadados). Sem `f_auto`: o formato final fica por conta da entrega.
 */
export const MEMBER_PHOTO_UPLOAD_TRANSFORM = "c_fill,g_face,w_512,h_512,q_auto";

/**
 * A MESMA transformação, no formato de parâmetros do SDK. Atenção: passar a string acima
 * em `transformation` faz o SDK tratá-la como NOME de transformação salva ("t_…") e o
 * Cloudinary recusa o upload.
 */
export const MEMBER_PHOTO_UPLOAD_TRANSFORM_PARAMS = [
  { crop: "fill", gravity: "face", width: 512, height: 512, quality: "auto" },
] as const;

/** Limite de trocas/remoções da foto por conta: 10 por hora. */
export const MEMBER_PHOTO_RATE = { limit: 10, windowSec: 3600 } as const;

const CLOUDINARY_ORIGIN = "https://res.cloudinary.com";
const CLOUD_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TENANT_RE = /^[a-z0-9-]{1,40}$/;
/** `<clube>/socios/fotos/<id>`: só o que o próprio upload gera. */
const PUBLIC_ID_RE = /^[a-z0-9-]{1,40}\/socios\/fotos\/[A-Za-z0-9_-]{1,64}$/;
const URL_MAX_CHARS = 512;
/** Caracteres de URL permitidos: sem espaço, aspas, <, >, crase nem barra invertida. */
const URL_SAFE_CHARS_RE = /^https:\/\/[^\s"'<>\\`]+$/;

/** Nome do bucket de upload do projeto (CLOUDINARY_CLOUD_NAME), com formato seguro. */
export function isValidCloudName(value: string | null | undefined): value is string {
  return typeof value === "string" && CLOUD_NAME_RE.test(value);
}

/**
 * Pasta de upload do clube: `<slug>/socios/fotos`. O slug é saneado (minúsculas, números e
 * hífen). Sem slug utilizável devolve null: a foto nunca vai para uma pasta sem clube.
 */
export function memberPhotoFolder(tenantSlug: string | null | undefined): string | null {
  if (!tenantSlug) return null;
  const slug = tenantSlug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!TENANT_RE.test(slug)) return null;
  return `${slug}/socios/fotos`;
}

/** O public_id é de foto de sócio DESTE clube (usado antes de apagar no Cloudinary). */
export function isMemberPhotoPublicIdFor(publicId: string | null | undefined, tenantSlug: string | null | undefined): boolean {
  const folder = memberPhotoFolder(tenantSlug);
  if (!folder || typeof publicId !== "string") return false;
  return PUBLIC_ID_RE.test(publicId) && publicId.startsWith(`${folder}/`);
}

/**
 * Tipo real do arquivo pelos primeiros bytes (assinatura). Devolve null para qualquer coisa
 * fora da allowlist: GIF, SVG, HTML, PDF, texto ou arquivo truncado.
 */
export function sniffMemberPhotoType(bytes: Uint8Array): MemberPhotoType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= PNG.length && PNG.every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  return null;
}

function ascii(bytes: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...bytes.slice(from, to));
}

/** O MIME declarado é da allowlist. */
export function isMemberPhotoType(value: unknown): value is MemberPhotoType {
  return typeof value === "string" && (MEMBER_PHOTO_TYPES as readonly string[]).includes(value);
}

/**
 * URL de ENTREGA gravada no banco. Lança se o cloud ou o public_id estiverem fora do
 * formato esperado (só acontece com dado corrompido; quem chama trata como falha).
 */
export function memberPhotoDeliveryUrl(cloudName: string, publicId: string): string {
  if (!isValidCloudName(cloudName)) throw new Error("cloud inválido");
  if (!PUBLIC_ID_RE.test(publicId)) throw new Error("public_id inválido");
  return `${CLOUDINARY_ORIGIN}/${cloudName}/image/upload/${MEMBER_PHOTO_TRANSFORM}/${publicId}`;
}

/**
 * photoUrl só se for a URL de entrega do PROJETO: https, host res.cloudinary.com, sem
 * credenciais, porta, query ou fragmento, com o cloud do projeto, a transformação de
 * entrega e um public_id de foto de sócio. Qualquer outra coisa vira null.
 */
export function safeMemberPhotoUrl(value: unknown, cloudName: string | null | undefined): string | null {
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

  const prefix = `/${cloudName}/image/upload/${MEMBER_PHOTO_TRANSFORM}/`;
  if (!parsed.pathname.startsWith(prefix)) return null;
  if (!PUBLIC_ID_RE.test(parsed.pathname.slice(prefix.length))) return null;
  return value;
}

/**
 * Checagem final antes de pôr a URL em `<img src>` (a tela não conhece o cloud name
 * publicamente): só o formato da URL de entrega de foto de sócio. Quem busca a URL no
 * banco já a validou com `safeMemberPhotoUrl`.
 */
const RENDERABLE_PHOTO_RE =
  /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]{1,64}\/image\/upload\/c_fill,g_face,w_512,h_512,q_auto,f_auto\/[a-z0-9-]{1,40}\/socios\/fotos\/[A-Za-z0-9_-]{1,64}$/;

export function isRenderableMemberPhotoSrc(value: unknown): value is string {
  return typeof value === "string" && value.length <= URL_MAX_CHARS && RENDERABLE_PHOTO_RE.test(value);
}

/**
 * Iniciais para o avatar, a partir do nome de exibição ("Maria S." -> "MS"; "Ana" -> "A").
 * Usa a primeira letra da primeira e da última palavra; sem letra devolve "?".
 */
export function memberInitials(name: string): string {
  const words = name.normalize("NFC").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = [...words[0]][0] ?? "";
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? "") : "";
  return `${first}${last}`.toLocaleUpperCase("pt-BR") || "?";
}
