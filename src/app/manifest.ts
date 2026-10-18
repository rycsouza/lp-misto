import type { MetadataRoute } from "next";
import { getSiteConfig } from "@/lib/config";
import { appTheme, buildAppIconUrls } from "@/lib/pwa/icons";

// Manifest PWA por tenant: nome, ícones e cores vêm do config do clube atual
// (resolvido pelo host). Sem nada do misto hardcoded.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const config = await getSiteConfig().catch(() => null);
  const name = config?.siteName?.trim() || "Clube";
  const { theme, background } = appTheme(config);
  // Logo do Cloudinary do projeto -> transformações na própria URL; senão ícone de
  // iniciais gerado em /app-icon/<tamanho>. Sempre PNG quadrado, com maskable separado.
  const icons = buildAppIconUrls(config, process.env.CLOUDINARY_CLOUD_NAME);
  const shortcutIcons = [{ src: icons.any192, sizes: "192x192", type: "image/png" }];

  return {
    id: "/",
    name,
    short_name: name.split(" - ")[0] || name,
    description: config?.description?.trim() || undefined,
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    categories: ["sports"],
    background_color: background,
    theme_color: theme,
    icons: [
      { src: icons.any192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icons.any512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: icons.maskable512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // "/conta?aba=socio" cai em "pedidos" quando a aba não existe: nunca quebra.
    shortcuts: [
      { name: "Minha conta", short_name: "Conta", url: "/conta", icons: shortcutIcons },
      { name: "Carteirinha de sócio", short_name: "Carteirinha", url: "/conta?aba=socio", icons: shortcutIcons },
      { name: "Ingressos", short_name: "Ingressos", url: "/ingresso", icons: shortcutIcons },
    ],
  };
}
