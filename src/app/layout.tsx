import type { Metadata } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { getSiteConfig } from "@/lib/config";
import { getAppBaseUrl } from "@/lib/base-url";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas-neue",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig().catch(() => null);
  const base = await getAppBaseUrl();
  // Tudo do tenant; sem literais do misto. Campos vazios são omitidos.
  const siteName = config?.siteName?.trim() || "Clube";
  const siteShortName = siteName.split(" - ")[0] || siteName;
  const description = config?.description?.trim() || undefined;
  const logoUrl = config?.clubLogoUrl?.trim() || undefined;
  const keywords = config?.keywords?.length ? config.keywords : undefined;
  // Favicon do tenant; sem favicon dedicado, cai no logo; sem nada, sem ícone.
  const iconUrl = config?.faviconUrl?.trim() || logoUrl;

  return {
    title: { default: siteName, template: `%s | ${siteShortName}` },
    ...(description ? { description } : {}),
    ...(base ? { metadataBase: new URL(base) } : {}),
    ...(keywords ? { keywords } : {}),
    ...(iconUrl ? { icons: { icon: iconUrl, apple: iconUrl } } : {}),
    openGraph: {
      siteName: siteShortName,
      locale: "pt_BR",
      type: "website",
      title: siteName,
      ...(description ? { description } : {}),
      ...(logoUrl ? { images: [{ url: logoUrl, width: 400, height: 400, alt: siteShortName }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: siteName,
      ...(description ? { description } : {}),
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await getSiteConfig().catch(() => null);
  // Tema por tenant: cada cor definida sobrescreve o token do build (globals.css).
  // Vazio = mantém o token padrão. Cores no formato CSS (ex.: "hsl(...)", "#rrggbb").
  const vars = [
    config?.primaryColor?.trim() && `--primary:${config.primaryColor.trim()};--ring:${config.primaryColor.trim()};`,
    config?.accentColor?.trim() && `--accent:${config.accentColor.trim()};`,
    config?.backgroundColor?.trim() && `--background:${config.backgroundColor.trim()};`,
    config?.cardColor?.trim() && `--card:${config.cardColor.trim()};--popover:${config.cardColor.trim()};`,
    config?.foregroundColor?.trim() && `--foreground:${config.foregroundColor.trim()};`,
    // Fontes: !important para vencer a classe do next/font no <html>. O valor é um
    // font-family CSS (use fontes do sistema/web-safe; webfonts custom = futuro).
    config?.fontHeading?.trim() && `--font-bebas-neue:${config.fontHeading.trim()} !important;`,
    config?.fontBody?.trim() && `--font-inter:${config.fontBody.trim()} !important;`,
  ]
    .filter(Boolean)
    .join("");
  const themeStyle = vars ? `:root{${vars}}` : null;

  return (
    <html lang="pt-BR" className={cn(bebasNeue.variable, inter.variable)}>
      <head>{themeStyle && <style>{themeStyle}</style>}</head>
      <body suppressHydrationWarning className="bg-background text-foreground overflow-x-hidden">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
