export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Trophy, Award } from "lucide-react";
import { getPublicRaffleBySlug, getRaffleWinners } from "@/lib/raffle/queries";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const raffle = await getPublicRaffleBySlug(slug).catch(() => null);
  return { title: raffle ? `Ganhadores — ${raffle.name}` : "Ganhadores" };
}

function fmtDate(d: Date | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
}

export default async function WinnersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const raffle = await getPublicRaffleBySlug(slug);
  if (!raffle) notFound();

  const winners = await getRaffleWinners(raffle.id);

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <Link href={`/rifa/${raffle.slug}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          ← Voltar ao sorteio
        </Link>

        <div className="text-center mb-10">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 text-primary mb-4">
            <Trophy size={28} />
          </span>
          <p className="text-primary text-xs font-semibold tracking-widest uppercase mb-1">Ganhadores</p>
          <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl md:text-5xl text-foreground">{raffle.name}</h1>
          {raffle.drawnAt && (
            <p className="text-sm text-muted-foreground mt-2">Sorteio realizado em {fmtDate(raffle.drawnAt)}</p>
          )}
        </div>

        {winners.length === 0 ? (
          <div className="border border-border rounded-xl p-10 text-center text-muted-foreground">
            O sorteio ainda não foi realizado. Volte em breve!
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {winners.map((w, i) => (
              <li key={w.prizeId} className="relative bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center gap-4 p-5">
                  {/* Foto do ganhador ou do prêmio */}
                  {w.winnerPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.winnerPhotoUrl} alt={w.winnerName} className="w-20 h-20 rounded-2xl object-cover border-2 border-primary shrink-0" />
                  ) : w.prizeImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.prizeImageUrl} alt={w.prizeName} className="w-20 h-20 rounded-2xl object-cover border border-border shrink-0" />
                  ) : (
                    <span className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground/40 shrink-0">
                      <Trophy size={28} />
                    </span>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                        {i + 1}º prêmio
                      </span>
                    </div>
                    <p className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground leading-tight mt-1">{w.winnerName}</p>
                    <p className="text-sm text-muted-foreground truncate">{w.prizeName}</p>
                  </div>

                  {/* Número sorteado */}
                  <div className="text-center shrink-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Número</p>
                    <p className="flex items-center gap-1 font-mono text-2xl font-bold text-primary">
                      <Award size={18} /> {w.winningNumber}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
