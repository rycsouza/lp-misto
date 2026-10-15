export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAdminSession } from "@/app/actions/admin-auth";
import { getSiteConfig } from "@/lib/config";
import { syncMemberById } from "@/lib/membership/sync";
import { getMemberCardView } from "@/lib/membership/card";
import { buildMemberCardData } from "@/lib/membership/card-data";
import {
  benefitsUntilIso,
  canUseValidation,
  describeCardStatus,
  memberShortCode,
} from "@/lib/membership/carteirinha-access";
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

const BANNER_TONE = {
  ok: "bg-green-600 text-white",
  warn: "bg-amber-500 text-zinc-950",
  bad: "bg-red-600 text-white",
} as const;

/**
 * Página do QR da carteirinha.
 *
 * - Equipe do clube (mesma regra do validador da portaria): vê a verificação
 *   completa — cartão + situação em destaque.
 * - Qualquer outro visitante: página neutra. A resposta é a MESMA com token válido,
 *   inválido ou inexistente, e não há consulta ao banco nesse caminho (não revela
 *   se o token existe nem os dados do sócio).
 * - Sem token: leva para a área do sócio na conta.
 */
export default async function CarteirinhaPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  if (!token) redirect("/conta?aba=socio");

  const session = await getAdminSession();
  if (!canUseValidation(session)) return <PublicCarteirinha />;

  return <TeamCarteirinha token={token} />;
}

function PublicCarteirinha() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-border rounded-2xl p-6 text-center">
          <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-2">
            Carteirinha de sócio-torcedor
          </h1>
          <p className="text-sm text-muted-foreground">Apresente esta carteirinha à equipe do clube.</p>
        </div>
        <PageLinks />
      </div>
    </main>
  );
}

async function TeamCarteirinha({ token }: { token: string }) {
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
        // Código curto só para a equipe digitar na portaria (nunca o token inteiro).
        memberCode: memberShortCode(token),
        clubColor: config.primaryColor,
        clubLogoUrl: config.clubLogoUrl,
        cardBackground: {
          url: config.memberCardBackgroundUrl,
          fit: config.memberCardBackgroundFit,
          opacity: config.memberCardBackgroundOpacity,
          blend: config.memberCardBackgroundBlend,
        },
      })
    : null;

  const situation =
    card && cardData
      ? describeCardStatus({
          status: card.status,
          hasBenefits: cardData.hasBenefits,
          benefitsUntil: benefitsUntilIso(card.status, cardData.hasBenefits, card.nextBillingDate),
        })
      : null;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-4">
        {cardData && situation ? (
          <>
            <div role="status" className={`rounded-2xl px-4 py-4 text-center ${BANNER_TONE[situation.tone]}`}>
              <p className="font-[family-name:var(--font-bebas-neue)] text-3xl leading-none">{situation.headline}</p>
              <p className="mt-1 text-xs font-semibold opacity-90">Confira um documento com foto.</p>
            </div>
            <MemberCard siteName={config.siteName} card={cardData} />
          </>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-2">Carteirinha inválida</h1>
            <p className="text-sm text-muted-foreground">Este link de carteirinha não é válido.</p>
          </div>
        )}
        <PageLinks />
      </div>
    </main>
  );
}

function PageLinks() {
  return (
    <div className="flex justify-center gap-4 text-xs text-muted-foreground">
      <Link href="/conta?aba=socio" className="hover:text-foreground transition-colors">É você? Veja sua carteirinha na sua conta</Link>
      <Link href="/" className="hover:text-foreground transition-colors">Voltar ao site</Link>
    </div>
  );
}
