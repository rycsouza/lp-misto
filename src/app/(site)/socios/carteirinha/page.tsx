import { getMemberByCardToken } from "@/app/actions/membership";
import { db } from "@/lib/db/client";
import { members, membershipPlans } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ token?: string; id?: string }>;
}

const STATUS_CONFIG = {
  active: { label: "ATIVO", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
  pending: { label: "AGUARDANDO PAGAMENTO", icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  cancelled: { label: "CANCELADO", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
};

export default async function CarteirinhaPage({ searchParams }: PageProps) {
  const { token, id } = await searchParams;

  let memberInfo: {
    name: string;
    email: string;
    planName: string;
    status: string;
    memberSince: string;
    memberCardToken: string | null;
  } | null = null;

  if (token) {
    const info = await getMemberByCardToken(token);
    if (info) memberInfo = { ...info, memberCardToken: token };
  } else if (id) {
    // Allow member to view their own card by memberId (after signup)
    const rows = await db
      .select({
        name: members.name,
        email: members.email,
        status: members.status,
        createdAt: members.createdAt,
        planName: membershipPlans.name,
        memberCardToken: members.memberCardToken,
      })
      .from(members)
      .leftJoin(membershipPlans, eq(members.planId, membershipPlans.id))
      .where(eq(members.id, id))
      .limit(1);

    const row = rows[0];
    if (row) {
      memberInfo = {
        name: row.name,
        email: row.email,
        planName: row.planName ?? "—",
        status: row.status,
        memberSince: row.createdAt.toLocaleDateString("pt-BR"),
        memberCardToken: row.memberCardToken,
      };
    }
  }

  if (!memberInfo) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Carteirinha não encontrada.</p>
          <Link href="/" className="text-primary hover:opacity-80 transition-opacity text-sm">
            Voltar ao site
          </Link>
        </div>
      </main>
    );
  }

  const statusConfig =
    STATUS_CONFIG[memberInfo.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const cardUrl = memberInfo.memberCardToken
    ? `${process.env.APP_URL ?? ""}/socios/carteirinha?token=${memberInfo.memberCardToken}`
    : null;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
          {/* Header */}
          <div className="bg-primary px-6 py-4">
            <p className="text-primary-foreground text-xs font-semibold tracking-widest uppercase opacity-80">
              Misto Esporte Clube
            </p>
            <h1 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-primary-foreground leading-tight">
              Sócio-Torcedor
            </h1>
          </div>

          {/* Body */}
          <div className="px-6 py-5 flex flex-col gap-4">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Nome</p>
              <p className="text-foreground font-semibold">{memberInfo.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Plano</p>
                <p className="text-foreground font-medium text-sm">{memberInfo.planName}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Membro desde</p>
                <p className="text-foreground font-medium text-sm">{memberInfo.memberSince}</p>
              </div>
            </div>

            {/* Status */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${statusConfig.bg}`}>
              <StatusIcon size={16} className={statusConfig.color} />
              <span className={`text-xs font-bold tracking-wider ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>

            {/* QR Code */}
            {cardUrl && memberInfo.status === "active" && (
              <div className="flex flex-col items-center gap-2 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">Apresente na entrada do estádio</p>
                <QRCodeSVG value={cardUrl} size={140} className="rounded" />
              </div>
            )}

            {memberInfo.status === "pending" && (
              <p className="text-xs text-muted-foreground text-center border-t border-border pt-3">
                O QR Code será ativado após a confirmação do pagamento.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="text-muted-foreground text-xs hover:text-foreground transition-colors">
            Voltar ao site
          </Link>
        </div>
      </div>
    </main>
  );
}
