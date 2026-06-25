export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { affiliates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  Share2,
  Users,
  DollarSign,
  LogOut,
  UserCheck,
  TrendingUp,
  Tag,
  Banknote,
  Clock,
} from "lucide-react";
import { CopyButton } from "./CopyButton";
import { getAffiliateSession, affiliateLogout } from "@/app/actions/affiliate-auth";
import { getAffiliatePortalData } from "@/app/actions/affiliate-portal";
import { WithdrawalForm } from "./WithdrawalForm";

interface Props {
  params: Promise<{ code: string }>;
}

function fmtCents(cents: number) {
  return `R$${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

const WITHDRAWAL_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  requested: { label: "Solicitado", className: "text-orange-500 bg-orange-500/10" },
  processing: { label: "Processando", className: "text-blue-500 bg-blue-500/10" },
  paid: { label: "Pago", className: "text-green-500 bg-green-500/10" },
  rejected: { label: "Rejeitado", className: "text-destructive bg-destructive/10" },
};

export default async function AffiliatePortalPage({ params }: Props) {
  const db = await getDb();
  const { code } = await params;
  const upperCode = code.toUpperCase();

  const session = await getAffiliateSession();
  if (!session) {
    redirect(`/afiliados/login`);
  }

  if (session.code !== upperCode) {
    redirect(`/afiliados/${session.code}`);
  }

  const [affiliate] = await db
    .select({
      id: affiliates.id,
      name: affiliates.name,
      code: affiliates.code,
      active: affiliates.active,
    })
    .from(affiliates)
    .where(eq(affiliates.code, upperCode))
    .limit(1);

  if (!affiliate || !affiliate.active) notFound();

  const data = await getAffiliatePortalData(affiliate.id, affiliate.code);

  const siteUrl = process.env.APP_URL ?? "https://mistoesporteclube.com.br";
  const referralLink = `${siteUrl}/?ref=${affiliate.code}`;

  async function logout() {
    "use server";
    await affiliateLogout();
  }

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

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-5 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/10 mb-3">
              <Users size={18} className="text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-foreground">{data.totalReferrals}</div>
            <div className="text-xs text-muted-foreground mt-1">Indicações (pedidos pagos)</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-500/10 mb-3">
              <DollarSign size={18} className="text-green-500" />
            </div>
            <div className="text-3xl font-bold text-foreground">
              {data.pendingCommissionCents > 0
                ? fmtCents(data.pendingCommissionCents)
                : "R$0,00"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Comissões a receber</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/10 mb-3">
              <TrendingUp size={18} className="text-purple-500" />
            </div>
            <div className="text-3xl font-bold text-foreground">{data.totalLeads}</div>
            <div className="text-xs text-muted-foreground mt-1">Leads gerados</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mb-3">
              <UserCheck size={18} className="text-primary" />
            </div>
            <div className="text-3xl font-bold text-foreground">{data.totalMembers}</div>
            <div className="text-xs text-muted-foreground mt-1">Sócios indicados</div>
          </div>
        </div>

        {/* Referral Link */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
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
            Código:{" "}
            <code className="font-mono bg-secondary px-1.5 py-0.5 rounded">
              {affiliate.code}
            </code>
          </p>
        </div>

        {/* Coupon */}
        {data.coupon && (
          <div className="bg-card border border-border rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Tag size={16} className="text-primary" />
              <h2 className="font-semibold text-sm text-foreground">Seu cupom de desconto</h2>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <code className="font-mono bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-sm font-bold tracking-wider">
                {data.coupon.code}
              </code>
              <span className="text-sm text-foreground font-semibold">
                {data.coupon.discountType === "pct"
                  ? `${data.coupon.discountValue}% de desconto`
                  : `${fmtCents(data.coupon.discountValue)} de desconto`}
              </span>
            </div>
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <span>
                Usos: {data.coupon.usageCount}
                {data.coupon.maxUsages != null ? ` / ${data.coupon.maxUsages}` : ""}
              </span>
              {data.coupon.expiresAt && (
                <span>Validade: {fmtDate(data.coupon.expiresAt)}</span>
              )}
            </div>
          </div>
        )}

        {/* Withdrawals */}
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote size={16} className="text-primary" />
              <h2 className="font-semibold text-sm text-foreground">Saques</h2>
            </div>
            {data.eligibleWithdrawalCents > 0 && (
              <span className="text-xs text-green-500 font-medium">
                {fmtCents(data.eligibleWithdrawalCents)} elegíveis
              </span>
            )}
          </div>

          {data.withdrawals.length > 0 ? (
            <div className="divide-y divide-border">
              {data.withdrawals.map((w) => {
                const statusInfo = WITHDRAWAL_STATUS_LABEL[w.status] ?? {
                  label: w.status,
                  className: "text-muted-foreground bg-secondary",
                };
                return (
                  <div key={w.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {fmtCents(w.amountCents)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        PIX: {w.pixKey}
                      </p>
                      {w.rejectionReason && (
                        <p className="text-xs text-destructive mt-0.5">{w.rejectionReason}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 ${statusInfo.className}`}
                      >
                        {statusInfo.label}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock size={10} />
                        {fmtDate(w.requestedAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Nenhum saque solicitado ainda.
            </div>
          )}

          {/* Withdrawal form */}
          <div className="px-5 py-5 border-t border-border">
            <WithdrawalForm
              affiliateId={affiliate.id}
              affiliateCode={affiliate.code}
              eligibleCents={data.eligibleWithdrawalCents}
            />
          </div>
        </div>

        {/* Logout */}
        <form action={logout} className="flex justify-center">
          <button
            type="submit"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut size={13} />
            Sair
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Dúvidas? Entre em contato com a diretoria do clube.
        </p>
      </div>
    </div>
  );
}
