import { memberUnitPriceCents } from "@/lib/membership/member-pricing";

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/** Selo discreto "Sócio {plano} −N%". Não renderiza sem desconto. */
export function MemberBadge({ planName, pct }: { planName: string; pct: number }) {
  if (!(pct > 0)) return null;
  return (
    <span className="inline-block max-w-full truncate rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold leading-tight text-primary">
      Sócio {planName} −{pct}%
    </span>
  );
}

/**
 * Preço de sócio: o "preço cheio" riscado (opcional) + o preço de sócio em
 * destaque + selo. Não renderiza nada sem desconto (pct 0 ou arredondamento = 0),
 * então quem não é sócio vê exatamente o que via antes.
 */
export function MemberPrice({
  shownCents,
  strikeCents = null,
  pct,
  planName,
  label,
  size = "lg",
}: {
  /** Preço que o cliente SEM benefício vê (base do desconto). */
  shownCents: number;
  /** Preço cheio para riscar; null para não riscar (ex.: "a partir de"). */
  strikeCents?: number | null;
  pct: number;
  planName: string;
  label?: string;
  size?: "sm" | "lg";
}) {
  if (!(pct > 0)) return null;
  const memberCents = memberUnitPriceCents(shownCents, pct);
  if (memberCents >= shownCents) return null;
  const showStrike = strikeCents != null && strikeCents > memberCents;
  return (
    <div className="flex flex-col items-start">
      {label && <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>}
      {showStrike && (
        <span className="text-xs leading-tight text-muted-foreground line-through">{formatBRL(strikeCents)}</span>
      )}
      <span className={`font-bold leading-tight text-primary ${size === "lg" ? "text-lg" : "text-sm"}`}>
        {formatBRL(memberCents)}
      </span>
      <span className="mt-0.5">
        <MemberBadge planName={planName} pct={pct} />
      </span>
    </div>
  );
}
