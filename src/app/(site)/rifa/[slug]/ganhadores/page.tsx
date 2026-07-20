export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Trophy, ArrowLeft, Sparkles, Medal } from "lucide-react";
import { getPublicRaffleBySlug, getRaffleWinners, type WinnerRow } from "@/lib/raffle/queries";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const raffle = await getPublicRaffleBySlug(slug).catch(() => null);
  return { title: raffle ? `Ganhadores — ${raffle.name}` : "Ganhadores" };
}

function fmtDate(d: Date | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
}

const MEDAL = [
  "bg-gradient-to-br from-yellow-300 to-amber-500 text-black",
  "bg-gradient-to-br from-slate-200 to-slate-400 text-black",
  "bg-gradient-to-br from-amber-600 to-amber-800 text-white",
];

function WinnerCard({ w, i, featured }: { w: WinnerRow; i: number; featured?: boolean }) {
  const medal = MEDAL[i] ?? "bg-primary/15 text-primary";
  return (
    <li
      className={`relative overflow-hidden rounded-2xl border ${
        featured ? "border-primary/40 bg-gradient-to-b from-primary/10 to-card" : "bg-card border-border"
      }`}
    >
      {/* brilho decorativo */}
      {featured && <div className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/20 blur-3xl" />}

      <div className={`relative flex items-center gap-4 ${featured ? "p-5 sm:p-6" : "p-4 sm:p-5"}`}>
        {/* Foto do ganhador ou do prêmio */}
        <div className="relative shrink-0">
          {w.winnerPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.winnerPhotoUrl} alt={w.winnerName} className={`${featured ? "w-24 h-24 sm:w-28 sm:h-28" : "w-20 h-20"} rounded-2xl object-cover border-2 border-primary`} />
          ) : w.prizeImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.prizeImageUrl} alt={w.prizeName} className={`${featured ? "w-24 h-24 sm:w-28 sm:h-28" : "w-20 h-20"} rounded-2xl object-cover border border-border`} />
          ) : (
            <span className={`${featured ? "w-24 h-24 sm:w-28 sm:h-28" : "w-20 h-20"} rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground/40`}>
              <Trophy size={featured ? 34 : 28} />
            </span>
          )}
          <span className={`absolute -top-2 -left-2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-md ${medal}`}>
            {i + 1}º
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${medal}`}>
            <Medal size={10} /> {i + 1}º prêmio
          </span>
          <p className={`font-[family-name:var(--font-bebas-neue)] ${featured ? "text-3xl sm:text-4xl" : "text-2xl"} text-foreground leading-tight mt-1.5`}>
            {w.winnerName}
          </p>
          <p className="text-sm text-muted-foreground truncate">{w.prizeName}</p>
        </div>

        {/* Número sorteado */}
        <div className="text-center shrink-0 pl-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Número</p>
          <p className={`font-mono ${featured ? "text-3xl sm:text-4xl" : "text-2xl"} font-bold text-primary tabular-nums`}>{w.winningNumber}</p>
        </div>
      </div>
    </li>
  );
}

export default async function WinnersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const raffle = await getPublicRaffleBySlug(slug);
  if (!raffle) notFound();

  const winners = await getRaffleWinners(raffle.id);
  const [first, ...rest] = winners;

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <Link href={`/rifa/${raffle.slug}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft size={15} /> Voltar ao sorteio
        </Link>

        <div className="text-center mb-10">
          <span className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 text-primary mb-4">
            <Trophy size={30} />
            <Sparkles size={16} className="absolute -top-1 -right-1 text-primary" />
          </span>
          <p className="text-primary text-xs font-semibold tracking-widest uppercase mb-1">Ganhadores</p>
          <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl md:text-6xl leading-[0.95] text-foreground">{raffle.name}</h1>
          {raffle.drawnAt && (
            <p className="text-sm text-muted-foreground mt-3">Sorteio realizado em {fmtDate(raffle.drawnAt)}</p>
          )}
        </div>

        {winners.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground">
            O sorteio ainda não foi realizado. Volte em breve!
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {first && <WinnerCard w={first} i={0} featured />}
            {rest.map((w, idx) => (
              <WinnerCard key={w.prizeId} w={w} i={idx + 1} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
