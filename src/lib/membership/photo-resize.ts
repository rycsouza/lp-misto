/**
 * Reduz a foto NO APARELHO antes do envio (só navegador): lado maior até 1600 px,
 * JPEG 0,85. Motivos: a Vercel recusa corpos acima de ~4,5 MB antes de chegar à
 * rota, e redesenhar no canvas descarta os metadados (EXIF/GPS) da câmera.
 * Se o navegador não suportar, devolve o arquivo original (o servidor valida tudo).
 */
export const PHOTO_MAX_SIDE = 1600;

export function scaledSize(width: number, height: number, maxSide = PHOTO_MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide || longest <= 0) return { width, height };
  const k = maxSide / longest;
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

export async function downscalePhoto(file: File): Promise<File> {
  try {
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const { width, height } = scaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], "foto.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/**
 * Logo no aparelho: mesma redução (lado maior até 1600 px), mas a saída é WebP (ou PNG, se o
 * navegador não codificar WebP: `toBlob` devolve PNG). NUNCA JPEG: JPEG não tem canal alpha e
 * achataria a transparência do logo num fundo preto ou branco. Se nada der certo, devolve o
 * arquivo original (o servidor valida tudo). Os metadados são descartados pelo redesenho.
 */
export async function downscaleLogo(file: File): Promise<File> {
  try {
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const { width, height } = scaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // Canvas começa transparente: não preencher o fundo, para o alpha do logo ser preservado.
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
    if (!blob || (blob.type !== "image/webp" && blob.type !== "image/png")) return file;
    return new File([blob], blob.type === "image/webp" ? "logo.webp" : "logo.png", { type: blob.type });
  } catch {
    return file;
  }
}
