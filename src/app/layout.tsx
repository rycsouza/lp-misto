import type { Metadata } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

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

export const metadata: Metadata = {
  title: {
    default: "Misto Esporte Clube — Três Lagoas/MS",
    template: "%s | Misto Esporte Clube",
  },
  description:
    "O Carcará da Fronteira. Fundado em 1993, representando Três Lagoas com garra e paixão no Campeonato Sul-Mato-Grossense.",
  metadataBase: new URL("https://mistoec.com.br"),
  openGraph: {
    siteName: "Misto Esporte Clube",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={cn(bebasNeue.variable, inter.variable)}>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded"
        >
          Ir para o conteúdo principal
        </a>
        {children}
      </body>
    </html>
  );
}
