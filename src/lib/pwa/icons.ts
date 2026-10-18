/**
 * Ícones do app (PWA / TWA) por clube. Módulo puro: sem I/O, sem env, sem fetch.
 *
 * Fontes aceitas para o ícone, em ordem:
 * 1. Logo do clube (`clubLogoUrl`) ou favicon, SE for upload do próprio projeto no
 *    Cloudinary (`https://res.cloudinary.com/<CLOUDINARY_CLOUD_NAME>/image/upload/...`).
 *    A transformação é feita PELO Cloudinary, na URL: nada é baixado no servidor.
 * 2. Caso contrário, a rota `/app-icon/<tamanho>` gera um ícone com as iniciais do
 *    clube sobre a cor primária. Nenhuma URL arbitrária é buscada pelo servidor (SSRF).
 *
 * Cores entram nas URLs e no manifest só como hex validado (#rgb ou #rrggbb).
 */
import { cardTextColor } from "@/lib/membership/card-visual";

/** Cor usada quando o clube não tem cor hex válida. Mesmo padrão do manifest anterior. */
export const DEFAULT_APP_COLOR = "#0a0a0a";

/** Rota que gera o ícone de fallback (iniciais). */
export const APP_ICON_ROUTE = "/app-icon";

/** Lista fechada de tamanhos aceitos pela rota de ícone. Qualquer outro valor é recusado. */
export const APP_ICON_KINDS = ["192", "512", "maskable-512", "180"] as const;
export type AppIconKind = (typeof APP_ICON_KINDS)[number];

interface AppIconSpec {
  /** Lado do quadrado em pixels. */
  px: number;
  /** Maskable: conteúdo menor, dentro da zona segura central (~80%), e fundo cheio. */
  maskable: boolean;
  /** Fundo sólido (sem transparência). Obrigatório no maskable e no apple-touch-icon. */
  solid: boolean;
}

export const APP_ICON_SPECS: Readonly<Record<AppIconKind, AppIconSpec>> = {
  "192": { px: 192, maskable: false, solid: false },
  "512": { px: 512, maskable: false, solid: false },
  "maskable-512": { px: 512, maskable: true, solid: true },
  // iOS não recorta transparência do apple-touch-icon: ele vira preto. Fundo sólido.
  "180": { px: 180, maskable: false, solid: true },
};

/** Logo ocupa 80% do lado no ícone comum (margem de 10% em cada borda). */
const ANY_LOGO_RATIO = 0.8;
/** Maskable: logo ocupa 62% do lado, bem dentro da zona segura (círculo de 80%). */
const MASKABLE_LOGO_RATIO = 0.62;

const CLOUDINARY_ORIGIN = "https://res.cloudinary.com";
const CLOUD_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;
/** Caminho depois de /image/upload/: versão opcional + public_id com extensão opcional. */
const UPLOAD_PATH_RE = /^(?:v\d{1,12}\/)?[A-Za-z0-9_\-/.]{1,1024}$/;
const URL_MAX_CHARS = 2048;

/** Palavras que não entram nas iniciais quando há outras palavras. */
const INITIALS_SKIP = new Set(["de", "da", "do", "das", "dos", "e", "the"]);

export interface AppIconConfig {
  siteName?: string | null;
  clubLogoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string | null;
  backgroundColor?: string | null;
}

export interface AppIconUrls {
  /** PNG quadrado, purpose "any", 192x192. */
  any192: string;
  /** PNG quadrado, purpose "any", 512x512. */
  any512: string;
  /** PNG quadrado, purpose "maskable", 512x512, com fundo sólido. */
  maskable512: string;
  /** apple-touch-icon, 180x180, fundo sólido. */
  apple180: string;
}

export interface AppTheme {
  /** theme_color do manifest e fundo do maskable/apple. Sempre hex válido. */
  theme: string;
  /** background_color do manifest. Sempre hex válido. */
  background: string;
}

/**
 * Hex validado e normalizado para minúsculas com 6 dígitos (#rrggbb).
 * Aceita #rgb e #rrggbb. Qualquer outra coisa (hsl, nomes, injeção) vira null.
 */
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(value.trim());
  if (!match) return null;
  const digits = match[1].toLowerCase();
  const full = digits.length === 3 ? digits.replace(/./g, (c) => c + c) : digits;
  return `#${full}`;
}

/** Tamanho pedido na rota. Só valores da lista fechada passam. */
export function parseAppIconKind(value: unknown): AppIconKind | null {
  return typeof value === "string" && (APP_ICON_KINDS as readonly string[]).includes(value)
    ? (value as AppIconKind)
    : null;
}

export interface CloudinaryUploadRef {
  cloudName: string;
  /** Caminho depois de /image/upload/ (pode começar com "v<versão>/"). */
  path: string;
}

/**
 * Referência a um upload DO PROJETO no Cloudinary, ou null.
 * Exige https, host res.cloudinary.com, sem credenciais nem porta, cloud igual à do
 * projeto (`cloudName`), caminho dentro de `/<cloud>/image/upload/` e sem segmentos
 * "." ou "..". A query e o fragmento são descartados.
 */
export function cloudinaryUploadRef(
  value: unknown,
  cloudName: string | null | undefined,
): CloudinaryUploadRef | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > URL_MAX_CHARS) return null;
  if (!cloudName || !CLOUD_NAME_RE.test(cloudName)) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.origin !== CLOUDINARY_ORIGIN) return null;
  if (url.username || url.password || url.port) return null;

  const prefix = `/${cloudName}/image/upload/`;
  if (!url.pathname.startsWith(prefix)) return null;
  const path = url.pathname.slice(prefix.length);
  if (!UPLOAD_PATH_RE.test(path)) return null;
  if (path.split("/").some((seg) => seg === "" || seg === "." || seg === "..")) return null;

  return { cloudName, path };
}

/** Tema do app: cores hex validadas, com o padrão quando inválidas. */
export function appTheme(config: AppIconConfig | null | undefined): AppTheme {
  return {
    theme: normalizeHexColor(config?.primaryColor) ?? DEFAULT_APP_COLOR,
    background: normalizeHexColor(config?.backgroundColor) ?? DEFAULT_APP_COLOR,
  };
}

function cloudinaryIconUrl(ref: CloudinaryUploadRef, kind: AppIconKind, color: string): string {
  const spec = APP_ICON_SPECS[kind];
  const logoRatio = spec.maskable ? MASKABLE_LOGO_RATIO : ANY_LOGO_RATIO;
  const inner = Math.round(spec.px * logoRatio);
  // `color` já é hex validado (#rrggbb); o Cloudinary quer sem "#".
  const fill = spec.solid ? `,b_rgb:${color.slice(1)}` : "";
  const chain = [
    `c_fit,w_${inner},h_${inner}`,
    `c_pad,w_${spec.px},h_${spec.px}${fill},f_png`,
  ];
  return `${CLOUDINARY_ORIGIN}/${ref.cloudName}/image/upload/${chain.join("/")}/${ref.path}`;
}

/**
 * URLs dos ícones do clube. Com logo do projeto no Cloudinary, usa transformações da
 * própria URL; sem ele, aponta para a rota de iniciais (`/app-icon/...`), que sempre existe.
 */
export function buildAppIconUrls(
  config: AppIconConfig | null | undefined,
  cloudName: string | null | undefined,
): AppIconUrls {
  const { theme } = appTheme(config);
  const ref =
    cloudinaryUploadRef(config?.clubLogoUrl, cloudName) ??
    cloudinaryUploadRef(config?.faviconUrl, cloudName);

  if (!ref) {
    return {
      any192: `${APP_ICON_ROUTE}/192`,
      any512: `${APP_ICON_ROUTE}/512`,
      maskable512: `${APP_ICON_ROUTE}/maskable-512`,
      apple180: `${APP_ICON_ROUTE}/180`,
    };
  }

  return {
    any192: cloudinaryIconUrl(ref, "192", theme),
    any512: cloudinaryIconUrl(ref, "512", theme),
    maskable512: cloudinaryIconUrl(ref, "maskable-512", theme),
    apple180: cloudinaryIconUrl(ref, "180", theme),
  };
}

/**
 * Iniciais do clube para o ícone de fallback. Só letras e dígitos ASCII (sem acento,
 * sem caractere que o fonte padrão não renderiza). Vazio vira "C".
 */
export function appIconInitials(siteName: string | null | undefined): string {
  const words = (siteName ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const meaningful = words.filter((w) => !INITIALS_SKIP.has(w.toLowerCase()));
  const pool = (meaningful.length ? meaningful : words).slice(0, 2);
  const letters = pool.map((w) => w[0].toUpperCase()).join("");
  return letters || "C";
}

/** Cor do texto sobre a cor de fundo do ícone de fallback (#ffffff ou #000000). */
export function appIconForeground(background: string): string {
  return cardTextColor(background);
}
