import type { Metadata } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { CartDrawer } from "@/components/ui/CartDrawer";

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
    default: "Misto Esporte Clube - Três Lagoas/MS",
    template: "%s | Misto Esporte Clube",
  },
  description:
    "O Carcará da Fronteira. Fundado em 1993, representando Três Lagoas com garra e paixão no Campeonato Sul-Mato-Grossense.",
  metadataBase: new URL("https://mistoec.com.br"),
  keywords: ["Misto Esporte Clube", "Carcará da Fronteira", "futebol", "Três Lagoas", "Mato Grosso do Sul"],
  openGraph: {
    siteName: "Misto Esporte Clube",
    locale: "pt_BR",
    type: "website",
    title: "Misto Esporte Clube - Três Lagoas/MS",
    description: "O Carcará da Fronteira. Fundado em 1993, representando Três Lagoas com garra e paixão.",
    images: [{ url: "https://res.cloudinary.com/df798ispp/image/upload/misto/misto-logotipo.jpg", width: 400, height: 400, alt: "Misto Esporte Clube" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Misto Esporte Clube - Três Lagoas/MS",
    description: "O Carcará da Fronteira. Fundado em 1993.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={cn(bebasNeue.variable, inter.variable)}>
      <body suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded"
        >
          Ir para o conteúdo principal
        </a>
        <Header />
        <CartDrawer />
        <main id="main-content" className="pt-16">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
