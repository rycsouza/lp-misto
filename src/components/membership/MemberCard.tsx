import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { AlertTriangle, CheckCircle2, Check, Clock, XCircle } from "lucide-react";
import { cardPalette } from "@/lib/membership/card-visual";
import type { MemberCardData } from "@/lib/membership/card-data";

export type { MemberCardData } from "@/lib/membership/card-data";

const STATUS_LABEL: Record<MemberCardData["status"], string> = {
  active: "ATIVO",
  pending: "AGUARDANDO PAGAMENTO",
  suspended: "SUSPENSO",
  cancelled: "CANCELADO",
};

const STATUS_ICON: Record<MemberCardData["status"], typeof Clock> = {
  active: CheckCircle2,
  pending: Clock,
  suspended: AlertTriangle,
  cancelled: XCircle,
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const fmtMonthYear = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

/**
 * Carteirinha de sócio no formato de cartão. Usada na área logada e na verificação
 * pública do QR. Só dados de exibição: nome, plano, situação, datas e benefícios.
 *
 * Sem benefício (aguardando, suspenso, cancelado fora do período): cartão
 * neutro com selo da situação, e sem QR.
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
  const palette = cardPalette(card.cardColor ?? card.clubColor, card.hasBenefits);
  const StatusIcon = STATUS_ICON[card.status] ?? Clock;
  const statusLabel = STATUS_LABEL[card.status] ?? STATUS_LABEL.pending;
  const benefitsUntil =
    card.status === "cancelled" && card.hasBenefits && card.nextBillingDate ? fmtDate(card.nextBillingDate) : null;

  return (
    <section aria-label="Carteirinha de sócio-torcedor" className="w-full max-w-[380px] mx-auto flex flex-col gap-4">
      <div
        className="relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-xl shadow-black/30 ring-1 ring-white/10"
        style={{ background: palette.background, color: palette.text }}
      >
        {/* Brilho e textura: só gradientes CSS, sem imagem externa. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(120% 90% at 100% 0%, rgba(255,255,255,0.28), transparent 55%), radial-gradient(80% 60% at 0% 100%, rgba(255,255,255,0.12), transparent 60%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-14 -bottom-16 size-48 rounded-full border-[16px] opacity-[0.12]"
          style={{ borderColor: palette.text }}
        />

        <div className="relative flex h-full flex-col justify-between p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center">
              {card.clubLogoUrl ? (
                <Image
                  src={card.clubLogoUrl}
                  alt={siteName || "Logo do clube"}
                  width={120}
                  height={36}
                  unoptimized
                  className="h-9 w-auto max-w-[45%] object-contain object-left"
                />
              ) : siteName ? (
                <span className="truncate text-xs font-bold uppercase tracking-[0.18em]">{siteName}</span>
              ) : null}
            </div>
            <div className="min-w-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-85">Sócio-torcedor</p>
              <p className="truncate font-[family-name:var(--font-bebas-neue)] text-xl leading-none">{card.planName}</p>
            </div>
          </div>

          {/* Chip decorativo. */}
          <div
            aria-hidden
            className="h-8 w-11 rounded-md border border-black/20 shadow-inner"
            style={{ background: "linear-gradient(135deg, #f6e7b4, #c9a45c 55%, #efd58a)" }}
          />

          <div className="flex items-end justify-between gap-3">
            <p className="line-clamp-2 min-w-0 break-words text-sm font-semibold uppercase leading-tight tracking-[0.14em] sm:text-base">
              {card.name}
            </p>
            <div className="flex shrink-0 flex-col items-end gap-1 text-right">
              <p className="text-[10px] font-medium tabular-nums opacity-90">
                Sócio desde {fmtMonthYear(card.memberSince)}
              </p>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider"
                style={{ background: palette.pill }}
              >
                <StatusIcon size={11} aria-hidden="true" />
                {statusLabel}
              </span>
              {benefitsUntil && <p className="text-[10px] opacity-90">Benefícios até {benefitsUntil}</p>}
            </div>
          </div>
        </div>

        {!card.hasBenefits && (
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span
              className="-rotate-12 rounded-md border-2 px-3 py-1 text-sm font-black tracking-[0.25em] opacity-80"
              style={{ borderColor: palette.text, color: palette.text }}
            >
              {statusLabel}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {card.status === "active" && card.nextBillingDate && (
          <p className="text-xs text-muted-foreground text-center">
            Próxima mensalidade: <span className="text-foreground">{fmtDate(card.nextBillingDate)}</span>
          </p>
        )}

        {card.status === "suspended" && (
          <p className="text-xs text-muted-foreground text-center">
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
          // Identificação de sócio — NÃO é ingresso (benefícios dependem do plano).
          // Painel branco: o contraste e a margem de silêncio deixam o QR fácil de ler.
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-4 text-zinc-900 shadow-md">
            <div className="text-center">
              <p className="text-sm font-semibold">Identificação de sócio</p>
              <p className="text-xs text-zinc-600">Apresente quando solicitado</p>
            </div>
            <QRCodeSVG value={card.qrValue} size={176} bgColor="#ffffff" fgColor="#000000" />
          </div>
        )}

        {card.status === "pending" && (
          <p className="text-xs text-muted-foreground text-center">
            O QR Code é liberado assim que o pagamento for confirmado.
          </p>
        )}

        {card.benefits.length > 0 && (
          <div className="border-t border-border pt-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">Seus benefícios</p>
            <ul className="flex flex-col gap-1.5 text-sm">
              {card.benefits.map((b) => (
                <li key={b.key} className="flex items-start gap-2 text-foreground">
                  <Check size={14} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{b.text}</span>
                </li>
              ))}
            </ul>
            {card.hasDiscounts && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Os descontos são aplicados automaticamente quando você compra logado na sua conta.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
