import type { MetadataRoute } from "next";
import { getSiteConfig } from "@/lib/config";

// Manifest PWA por tenant: nome, ícone e cores vêm do config do clube atual
// (resolvido pelo host). Sem nada do misto hardcoded.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const config = await getSiteConfig().catch(() => null);
  const name = config?.siteName?.trim() || "Clube";
  const icon = config?.faviconUrl?.trim() || config?.clubLogoUrl?.trim();
  // Declara 192 e 512 (heurística de instalabilidade do Android) + um maskable,
  // todos apontando para o ícone do clube. A qualidade real depende do logo que
  // o clube enviar — passo já cobrado no checklist de ativação.
  const icons = icon
    ? [
        { src: icon, sizes: "192x192", purpose: "any" as const },
        { src: icon, sizes: "512x512", purpose: "any" as const },
        { src: icon, sizes: "any", purpose: "maskable" as const },
      ]
    : undefined;
  return {
    name,
    short_name: name.split(" - ")[0] || name,
    description: config?.description?.trim() || undefined,
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: config?.backgroundColor?.trim() || "#0a0a0a",
    theme_color: config?.primaryColor?.trim() || "#0a0a0a",
    ...(icons ? { icons } : {}),
  };
}
