import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { affiliates, affiliateReferrals } from "@/lib/db/schema";
import { eq, count, sum } from "drizzle-orm";
import { Share2, Users, DollarSign, Copy } from "lucide-react";
import { CopyButton } from "./CopyButton";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function AffiliatePortalPage({ params }: Props) {
  const { code } = await params;
  const upperCode = code.toUpperCase();

  const [affiliate] = await db
    .select({ id: affiliates.id, name: affiliates.name, code: affiliates.code, active: affiliates.active })
    .from(affiliates)
    .where(eq(affiliates.code, upperCode))
    .limit(1);

  if (!affiliate || !affiliate.active) notFound();

  const [stats] = await db
    .select({
      total: count(),
      paidCount: count(),
      totalCommissionCents: sum(affiliateReferrals.commissionCents),
    })
    .from(affiliateReferrals)
    .where(eq(affiliateReferrals.affiliateId, affiliate.id));

  const paidStats = await db
    .select({ paidCents: sum(affiliateReferrals.commissionCents) })
    .from(affiliateReferrals)
    .where(eq(affiliateReferrals.affiliateId, affiliate.id));

  const totalReferrals = Number(stats?.total ?? 0);
  const totalCommission = Number(paidStats[0]?.paidCents ?? 0);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const referralLink = `${siteUrl}/?ref=${affiliate.code}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-20">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
            <Share2 size={24} className="text-primary" />
          </div>
          <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-foreground">
            Portal do Afiliado
          </h1>
          <p className="text-muted-foreground mt-2">Olá, {affiliate.name}!</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-5 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/10 mb-3">
              <Users size={18} className="text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-foreground">{totalReferrals}</div>
            <div className="text-xs text-muted-foreground mt-1">Indicações</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-500/10 mb-3">
              <DollarSign size={18} className="text-green-500" />
            </div>
            <div className="text-3xl font-bold text-foreground">
              {totalCommission > 0
                ? `R$${(totalCommission / 100).toFixed(2).replace(".", ",")}`
                : "R$0,00"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Comissões geradas</div>
          </div>
        </div>

        {/* Referral Link */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-sm text-foreground mb-1">Seu link de indicação</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Compartilhe este link. Quando alguém comprar através dele, você recebe comissão.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-secondary rounded-lg px-3 py-2.5 text-sm font-mono text-foreground truncate">
              {referralLink}
            </div>
            <CopyButton text={referralLink} />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Código: <code className="font-mono bg-secondary px-1.5 py-0.5 rounded">{affiliate.code}</code>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Dúvidas? Entre em contato com a diretoria do clube.
        </p>
      </div>
    </div>
  );
}
