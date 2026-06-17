import Image from "next/image";
import Link from "next/link";
import { getAllSectionMeta, getSiteConfig } from "@/lib/config";

function MailIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <path d="M22 6L12 13 2 6" />
    </svg>
  );
}

function PhoneIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.71 3.45 2 2 0 0 1 3.68 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.64a16 16 0 0 0 6 6l1.06-1.06a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

const ALL_NAV_LINKS: { href: string; label: string; sectionKey?: string }[] = [
  { href: "/#inicio",         label: "Início" },
  { href: "/#ingressos",      label: "Ingressos",      sectionKey: "ticket_highlight" },
  { href: "/#noticias",       label: "Notícias",       sectionKey: "news" },
  { href: "/#elenco",         label: "Elenco",         sectionKey: "squad" },
  { href: "/#diretoria",      label: "Diretoria",      sectionKey: "board" },
  { href: "/#historia",       label: "História",       sectionKey: "history" },
  { href: "/#socio",          label: "Sócio",          sectionKey: "membership" },
  { href: "/#patrocinadores", label: "Patrocinadores", sectionKey: "sponsors" },
  { href: "/#loja",           label: "Loja",           sectionKey: "shop" },
];

export default async function Footer() {
  const [meta, config] = await Promise.all([
    getAllSectionMeta(["ticket_highlight", "news", "squad", "board", "history", "membership", "sponsors", "shop"]),
    getSiteConfig(),
  ]);

  const email = config.email?.trim() || null;
  const whatsapp = config.whatsapp?.trim() ? config.whatsapp.trim().replace(/\D/g, "") : null;
  const instagram = config.instagram?.trim() || null;
  const hasContact = email || whatsapp || instagram;

  const visibleLinks = ALL_NAV_LINKS
    .filter((link) => !link.sectionKey || meta[link.sectionKey]?.enabled !== false)
    .sort((a, b) => {
      const orderA = a.sectionKey ? (meta[a.sectionKey]?.order ?? 999) : 0;
      const orderB = b.sectionKey ? (meta[b.sectionKey]?.order ?? 999) : 0;
      return orderA - orderB;
    });

  return (
    <footer className="bg-card border-t border-border mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image
                src="https://res.cloudinary.com/df798ispp/image/upload/misto/misto-logotipo.jpg"
                alt="Misto Esporte Clube"
                width={48}
                height={48}
                className="rounded-sm"
              />
              <span className="font-[family-name:var(--font-bebas-neue)] text-xl text-primary">
                Misto EC
              </span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Carcará da Fronteira. Fundado em 1993, representando Três Lagoas/MS.
            </p>
          </div>

          <div>
            <h3 className="font-[family-name:var(--font-bebas-neue)] text-lg text-foreground mb-4">
              Navegação
            </h3>
            <nav className="flex flex-col gap-2" aria-label="Links do rodapé">
              {visibleLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          {hasContact && (
            <div>
              <h3 className="font-[family-name:var(--font-bebas-neue)] text-lg text-foreground mb-4">
                Contato
              </h3>
              <div className="flex flex-col gap-3">
                {email && (
                  <a
                    href={`mailto:${email}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <MailIcon size={16} />
                    {email}
                  </a>
                )}
                {whatsapp && (
                  <a
                    href={`https://wa.me/${whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <PhoneIcon size={16} />
                    +{whatsapp}
                  </a>
                )}
                {instagram && (
                  <a
                    href={instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <InstagramIcon size={16} />
                    @{instagram.replace(/.*instagram\.com\//, "").replace(/\/$/, "")}
                  </a>
                )}
              </div>
            </div>
          )}

        </div>

        <div className="border-t border-border mt-8 pt-8 text-center">
          <p className="text-xs text-muted-foreground">
            © 2026 Misto Esporte Clube. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
