export const dynamic = "force-dynamic";

import { getSiteConfig } from "@/lib/config";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, XCircle, Clock, AlertTriangle, Ticket, ShoppingBag, Check } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { syncMemberById } from "@/lib/membership/sync";
import { getMemberCardView } from "@/lib/membership/card";
import { rateLimit } from "@/lib/ratelimit";
import { getAppBaseUrl } from "@/lib/base-url";
import { MemberCardRequestForm } from "@/components/membership/MemberCardRequestForm";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  return {
    title: config.siteName ? `Carteirinha de Sócio — ${config.siteName}` : "Carteirinha de Sócio",
    // Página com dados do sócio acessada por link secreto: fora dos buscadores.
    robots: { index: false, follow: false },
  };
}

const STATUS_CONFIG = {
  active: { label: "ATIVO", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
  pending: { label: "AGUARDANDO PAGAMENTO", icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  suspended: { label: "SUSPENSO — PAGAMENTO EM ATRASO", icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10" },
  cancelled: { label: "CANCELADO", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
};

const fmtDate = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/**
 * Autorrecuperação: se o sócio ainda aparece "pendente", consulta o gateway
 * (fonte da verdade) antes de renderizar — cobre webhook perdido/atrasado.
 * Limite por sócio para não martelar o gateway a cada refresh.
 */
async function refreshPendingMember(memberId: string): Promise<void> {
  try {
    const { ok } = await rateLimit(`rl:member-sync:${memberId}`, 1, 20);
    if (ok) await syncMemberById(memberId);
  } catch (err) {
    console.error("[carteirinha] falha ao sincronizar sócio pendente:", err);
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}

export default async function CarteirinhaPage({ searchParams }: PageProps) {
  const config = await getSiteConfig();
  const { token } = await searchParams;

  let card = token ? await getMemberCardView(token) : null;
  if (card?.status === "pending") {
    await refreshPendingMember(card.memberId);
    card = await getMemberCardView(token!);
  }

  // Sem token (ou token inválido): "Minha carteirinha" — link por e-mail.
  if (!card) {
    return (
      <Shell>
        <div className="bg-card border border-border rounded-2xl p-6">
          <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-1">
            Minha carteirinha
          </h1>
          <p className="text-sm text-muted-foreground mb-5">
            {token
              ? "Este link de carteirinha não é válido. Receba o link atualizado no seu e-mail."
              : "Informe o e-mail da sua adesão e enviamos o link da sua carteirinha de sócio."}
          </p>
          <MemberCardRequestForm />
        </div>
        <div className="mt-4 flex justify-center gap-4 text-xs text-muted-foreground">
          <Link href="/socios/adesao" className="hover:text-foreground transition-colors">Quero ser sócio</Link>
          <Link href="/" className="hover:text-foreground transition-colors">Voltar ao site</Link>
        </div>
      </Shell>
    );
  }

  const statusConfig = STATUS_CONFIG[card.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const isActive = card.status === "active";
  // Domínio do CLUBE (multi-tenant) — APP_URL é único e apontava o QR para o host errado.
  const baseUrl = await getAppBaseUrl();
  const cardUrl = `${baseUrl}/socios/carteirinha?token=${encodeURIComponent(token!)}`;

  return (
    <Shell>
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        {/* Header */}
        <div className="bg-primary px-6 py-4">
          {config.siteName && (
            <p className="text-primary-foreground text-xs font-semibold tracking-widest uppercase opacity-80">
              {config.siteName}
            </p>
          )}
          <h1 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-primary-foreground leading-tight">
            Sócio-Torcedor
          </h1>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Nome</p>
            <p className="text-foreground font-semibold">{card.name}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Plano</p>
              <p className="text-foreground font-medium text-sm">{card.planName}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Sócio desde</p>
              <p className="text-foreground font-medium text-sm">{fmtDate(card.memberSince)}</p>
            </div>
          </div>

          {/* Status */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${statusConfig.bg}`}>
            <StatusIcon size={16} className={statusConfig.color} />
            <span className={`text-xs font-bold tracking-wider ${statusConfig.color}`}>{statusConfig.label}</span>
          </div>

          {isActive && card.nextBillingDate && (
            <p className="text-xs text-muted-foreground -mt-2">
              Próxima mensalidade: <span className="text-foreground">{fmtDate(card.nextBillingDate)}</span>
            </p>
          )}

          {/* QR — só com a assinatura em dia */}
          {isActive && (
            <div className="flex flex-col items-center gap-2 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">Apresente na entrada do estádio</p>
              <div className="bg-white p-2 rounded">
                <QRCodeSVG value={cardUrl} size={140} />
              </div>
            </div>
          )}

          {card.status === "pending" && (
            <p className="text-xs text-muted-foreground text-center border-t border-border pt-3">
              O QR Code é liberado assim que o pagamento for confirmado. Esta página atualiza o status ao ser aberta.
            </p>
          )}

          {/* Benefícios */}
          {(card.ticketDiscountPct > 0 || card.productDiscountPct > 0 || card.benefits.length > 0) && (
            <div className="border-t border-border pt-3">
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">Seus benefícios</p>
              <ul className="flex flex-col gap-1.5 text-sm">
                {card.ticketDiscountPct > 0 && (
                  <li className="flex items-center gap-2 text-foreground">
                    <Ticket size={14} className="text-primary shrink-0" />
                    {card.ticketDiscountPct}% de desconto em ingressos
                  </li>
                )}
                {card.productDiscountPct > 0 && (
                  <li className="flex items-center gap-2 text-foreground">
                    <ShoppingBag size={14} className="text-primary shrink-0" />
                    {card.productDiscountPct}% de desconto na loja
                  </li>
                )}
                {card.benefits.map((b) => (
                  <li key={b} className="flex items-center gap-2 text-foreground">
                    <Check size={14} className="text-primary shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
              {(card.ticketDiscountPct > 0 || card.productDiscountPct > 0) && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Os descontos são aplicados automaticamente ao comprar com o e-mail da sua adesão.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Dica: salve esta página nos favoritos ou adicione à tela inicial para mostrar na entrada.
      </p>
      <div className="mt-2 text-center">
        <Link href="/" className="text-muted-foreground text-xs hover:text-foreground transition-colors">
          Voltar ao site
        </Link>
      </div>
    </Shell>
  );
}
