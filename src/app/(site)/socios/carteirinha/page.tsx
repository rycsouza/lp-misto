export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSiteConfig } from "@/lib/config";
import { syncMemberById } from "@/lib/membership/sync";
import { getMemberCardView } from "@/lib/membership/card";
import { buildMemberCardData } from "@/lib/membership/card-data";
import { rateLimit } from "@/lib/ratelimit";
import { getAppBaseUrl } from "@/lib/base-url";
import { MemberCard } from "@/components/membership/MemberCard";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  return {
    title: config.siteName ? `Carteirinha de Sócio — ${config.siteName}` : "Carteirinha de Sócio",
    // Página acessada pelo QR (segredo do sócio): fora dos buscadores.
    robots: { index: false, follow: false },
  };
}

/**
 * Verificação do QR da carteirinha (o que a portaria/loja vê ao escanear) e
 * links antigos de e-mail. Só leitura. O sócio vê e gerencia a carteirinha na
 * área logada (/conta) — sem token, a página leva para lá.
 */
export default async function CarteirinhaPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  if (!token) redirect("/conta?aba=socio");

  const config = await getSiteConfig();
  let card = await getMemberCardView(token);
  // Pendente: reconsulta o gateway (webhook perdido/atrasado), com limite por sócio.
  if (card?.status === "pending") {
    try {
      if ((await rateLimit(`rl:member-sync:${card.memberId}`, 1, 20)).ok) await syncMemberById(card.memberId);
    } catch (err) {
      console.error("[carteirinha] falha ao sincronizar sócio pendente:", err);
    }
    card = await getMemberCardView(token);
  }

  const cardData = card
    ? buildMemberCardData(card, {
        // Mesmo link do QR: a portaria lê e cai nesta página.
        qrValue: `${await getAppBaseUrl()}/socios/carteirinha?token=${encodeURIComponent(token)}`,
        clubColor: config.primaryColor,
        clubLogoUrl: config.clubLogoUrl,
      })
    : null;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {cardData ? (
          <MemberCard siteName={config.siteName} card={cardData} />
        ) : (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-2">Carteirinha inválida</h1>
            <p className="text-sm text-muted-foreground">Este link de carteirinha não é válido.</p>
          </div>
        )}
        <div className="mt-4 flex justify-center gap-4 text-xs text-muted-foreground">
          <Link href="/conta?aba=socio" className="hover:text-foreground transition-colors">É você? Veja na sua conta</Link>
          <Link href="/" className="hover:text-foreground transition-colors">Voltar ao site</Link>
        </div>
      </div>
    </main>
  );
}
