import type { Metadata } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { getSiteConfig } from "@/lib/config";
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
  const logoUrl =
    config?.clubLogoUrl ??
    "https://res.cloudinary.com/df798ispp/image/upload/misto/misto-logotipo.jpg";

  return {
    title: {
      default: "Misto Esporte Clube - Três Lagoas/MS",
      template: "%s | Misto Esporte Clube",
    },
    description:
      "O Carcará da Fronteira. Fundado em 1993, representando Três Lagoas com garra e paixão no Campeonato Sul-Mato-Grossense.",
    metadataBase: new URL("https://mistoec.com.br"),
    keywords: ["Misto Esporte Clube", "Carcará da Fronteira", "futebol", "Três Lagoas", "Mato Grosso do Sul"],
    openGraph: {
      siteName: "Loja Oficial do Misto Esporte Clube",
      locale: "pt_BR",
      type: "website",
      title: "Loja Oficial do Misto Esporte Clube",
      description: "O Carcará da Fronteira. Fundado em 1993, representando Três Lagoas com garra e paixão.",
      images: [{ url: logoUrl, width: 400, height: 400, alt: "Misto Esporte Clube" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Loja Oficial do Misto Esporte Clube",
      description: "O Carcará da Fronteira. Fundado em 1993.",
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={cn(bebasNeue.variable, inter.variable)}>
      <body suppressHydrationWarning className="bg-background text-foreground overflow-x-hidden">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
