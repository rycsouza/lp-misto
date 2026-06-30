import type { MetadataRoute } from "next";
import { getSiteConfig } from "@/lib/config";

// Manifest PWA por tenant: nome, ícone e cores vêm do config do clube atual
// (resolvido pelo host). Sem nada do misto hardcoded.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const config = await getSiteConfig().catch(() => null);
  const name = config?.siteName?.trim() || "Clube";
  const icon = config?.faviconUrl?.trim() || config?.clubLogoUrl?.trim();
  return {
    name,
    short_name: name.split(" - ")[0] || name,
    start_url: "/",
    display: "standalone",
    background_color: config?.backgroundColor?.trim() || "#0a0a0a",
    theme_color: config?.primaryColor?.trim() || "#0a0a0a",
    ...(icon ? { icons: [{ src: icon, sizes: "any" }] } : {}),
  };
}
