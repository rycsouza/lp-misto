import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { CartDrawer } from "@/components/ui/CartDrawer";
import { InstallAppPrompt } from "@/components/site/InstallAppPrompt";
import { SiteBottomNav } from "@/components/layout/SiteBottomNav";
import { getSiteConfig } from "@/lib/config";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const instagram = (await getSiteConfig().catch(() => null))?.instagram?.trim() || null;

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded"
      >
        Ir para o conteúdo principal
      </a>
      <Header />
      <CartDrawer />
      <main id="main-content" className="pt-16 pb-24 lg:pb-0">
        {children}
      </main>
      <Footer />
      <SiteBottomNav instagram={instagram} />
      <InstallAppPrompt />
    </>
  );
}
