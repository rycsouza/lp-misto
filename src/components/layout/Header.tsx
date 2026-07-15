import Image from "next/image";
import Link from "next/link";
import { getAllSectionMeta, getSiteConfig } from "@/lib/config";
import { CartIcon } from "@/components/ui/CartIcon";

function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Maps each nav entry to its sectionKey so we can hide it when disabled.
// "inicio" (hero) is always shown — no sectionKey filter needed.
const ALL_NAV_LINKS: { href: string; label: string; sectionKey?: string }[] = [
  { href: "/#inicio",        label: "Início" },
  { href: "/#ingressos",     label: "Ingressos",     sectionKey: "ticket_highlight" },
  { href: "/#noticias",      label: "Notícias",      sectionKey: "news" },
  { href: "/#elenco",        label: "Elenco",        sectionKey: "squad" },
  { href: "/#diretoria",     label: "Diretoria",     sectionKey: "board" },
  { href: "/#historia",      label: "História",      sectionKey: "history" },
  { href: "/#socio",         label: "Sócio",         sectionKey: "membership" },
  { href: "/#patrocinadores",label: "Patrocinadores", sectionKey: "sponsors" },
  { href: "/#loja",          label: "Loja",          sectionKey: "shop" },
];

export default async function Header() {
  const [meta, config] = await Promise.all([
    getAllSectionMeta(["ticket_highlight", "news", "squad", "board", "history", "membership", "sponsors", "shop"]),
    getSiteConfig(),
  ]);
  const instagram = config.instagram?.trim() || null;

  const visibleLinks = ALL_NAV_LINKS
    .filter((link) => !link.sectionKey || meta[link.sectionKey]?.enabled !== false)
    .sort((a, b) => {
      const orderA = a.sectionKey ? (meta[a.sectionKey]?.order ?? 999) : 0;
      const orderB = b.sectionKey ? (meta[b.sectionKey]?.order ?? 999) : 0;
      return orderA - orderB;
    })
    .map(({ href, label }) => ({ href, label }));

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image
              src={config.clubLogoUrl}
              alt={config.siteName || "Logo do clube"}
              width={40}
              height={40}
              className="rounded-sm"
              style={{ width: 40, height: "auto" }}
              unoptimized
            />
            {config.siteName && (
              <span className="font-[family-name:var(--font-bebas-neue)] text-xl text-primary hidden sm:block">
                {config.siteName}
              </span>
            )}
          </Link>

          <nav className="hidden lg:flex items-center gap-6" aria-label="Navegação principal">
            {visibleLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
            <span className="text-border">|</span>
            <Link
              href="/pedidos"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Meus Pedidos
            </Link>
          </nav>

          {/* Ações utilitárias — só desktop. No mobile/tablet elas vivem no
              SiteBottomNav flutuante (com rótulo), mais fáceis de achar. */}
          <div className="hidden lg:flex items-center gap-3">
            <CartIcon />
            {instagram && (
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={config.siteName ? `Instagram do ${config.siteName}` : "Instagram"}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <InstagramIcon size={20} />
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
