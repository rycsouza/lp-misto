import Image from "next/image";
import Link from "next/link";
import { getAllSectionMeta, getSiteConfig } from "@/lib/config";
import { getActiveAccountabilityReports } from "@/lib/db/queries";
import { CartIcon } from "@/components/ui/CartIcon";
import { ChevronDown } from "lucide-react";

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

export default async function Header({ hiddenSections = [] }: { hiddenSections?: string[] }) {
  const [meta, config, reports] = await Promise.all([
    getAllSectionMeta(["ticket_highlight", "news", "squad", "board", "history", "membership", "sponsors", "shop"]),
    getSiteConfig(),
    getActiveAccountabilityReports().catch(() => []),
  ]);
  const instagram = config.instagram?.trim() || null;
  const hidden = new Set(hiddenSections);

  const boardVisible = meta["board"]?.enabled !== false && !hidden.has("board");
  const showAccountability = boardVisible && reports.length > 0;

  const visibleLinks = ALL_NAV_LINKS
    .filter((link) => !link.sectionKey || (meta[link.sectionKey]?.enabled !== false && !hidden.has(link.sectionKey)))
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
            {visibleLinks.map((link) => {
              // Diretoria vira um item com sub-menu quando há prestação de contas.
              if (link.href === "/#diretoria" && showAccountability) {
                return (
                  <div key={link.href} className="relative group">
                    <a
                      href={link.href}
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground group-hover:text-foreground focus-within:text-foreground transition-colors"
                    >
                      {link.label}
                      <ChevronDown size={13} className="opacity-60 transition-transform group-hover:rotate-180" />
                    </a>
                    {/* pt-3 cria a "ponte" de hover entre o gatilho e o menu */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 hidden group-hover:block group-focus-within:block">
                      <div className="min-w-[190px] rounded-xl border border-border bg-card shadow-lg shadow-black/20 p-1">
                        <a href="/#diretoria" className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                          Diretoria
                        </a>
                        <a href="/#prestacao-contas" className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                          Prestação de Contas
                        </a>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </a>
              );
            })}
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
