import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, XCircle, Clock, AlertTriangle, Ticket, ShoppingBag, Check } from "lucide-react";

export interface MemberCardData {
  name: string;
  planName: string;
  status: "pending" | "active" | "suspended" | "cancelled";
  /** ISO */
  memberSince: string;
  /** ISO */
  nextBillingDate: string | null;
  ticketDiscountPct: number;
  productDiscountPct: number;
  benefits: string[];
  /** Em dia, ou cancelado dentro do período pago (QR + benefícios). */
  hasBenefits: boolean;
  /** Conteúdo do QR de identificação. */
  qrValue: string;
}

const STATUS_CONFIG = {
  active: { label: "ATIVO", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
  pending: { label: "AGUARDANDO PAGAMENTO", icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  suspended: { label: "SUSPENSO — PAGAMENTO EM ATRASO", icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10" },
  cancelled: { label: "CANCELADO", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/**
 * Carteirinha de sócio (visual). Usada na área logada e na verificação pública
 * do QR. Só dados de exibição: nome, plano, situação e benefícios.
 */
export function MemberCard({
  card,
  siteName,
  invoiceUrl,
}: {
  card: MemberCardData;
  siteName?: string | null;
  invoiceUrl?: string | null;
}) {
  const statusConfig = STATUS_CONFIG[card.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const statusLabel =
    card.status === "cancelled" && card.hasBenefits && card.nextBillingDate
      ? `CANCELADO — BENEFÍCIOS ATÉ ${fmtDate(card.nextBillingDate)}`
      : statusConfig.label;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
      <div className="bg-primary px-6 py-4">
        {siteName && (
          <p className="text-primary-foreground text-xs font-semibold tracking-widest uppercase opacity-80">{siteName}</p>
        )}
        <p className="font-[family-name:var(--font-bebas-neue)] text-2xl text-primary-foreground leading-tight">
          Sócio-Torcedor
        </p>
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

        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${statusConfig.bg}`}>
          <StatusIcon size={16} className={statusConfig.color} />
          <span className={`text-xs font-bold tracking-wider ${statusConfig.color}`}>{statusLabel}</span>
        </div>

        {card.status === "active" && card.nextBillingDate && (
          <p className="text-xs text-muted-foreground -mt-2">
            Próxima mensalidade: <span className="text-foreground">{fmtDate(card.nextBillingDate)}</span>
          </p>
        )}

        {card.status === "suspended" && (
          <p className="text-xs text-muted-foreground -mt-2">
            Sua mensalidade está em atraso. QR Code e descontos voltam assim que o pagamento for confirmado.
          </p>
        )}

        {invoiceUrl && (
          <a
            href={invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Pagar mensalidade
          </a>
        )}

        {card.hasBenefits && (
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-border">
            {/* Identificação de sócio — NÃO é ingresso (benefícios dependem do plano). */}
            <p className="text-xs text-muted-foreground">Identificação de sócio — apresente quando solicitado</p>
            <div className="bg-white p-2 rounded">
              <QRCodeSVG value={card.qrValue} size={140} />
            </div>
          </div>
        )}

        {card.status === "pending" && (
          <p className="text-xs text-muted-foreground text-center border-t border-border pt-3">
            O QR Code é liberado assim que o pagamento for confirmado.
          </p>
        )}

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
                Os descontos são aplicados automaticamente quando você compra logado na sua conta.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
