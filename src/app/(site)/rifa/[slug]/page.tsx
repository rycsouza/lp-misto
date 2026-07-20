export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Trophy, Clock, ArrowRight } from "lucide-react";
import { getPublicRaffleBySlug } from "@/lib/raffle/queries";
import { RaffleBuy } from "@/components/raffle/RaffleBuy";

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const raffle = await getPublicRaffleBySlug(slug).catch(() => null);
  if (!raffle) return { title: "Sorteio não encontrado" };
  return {
    title: `${raffle.name} — Sorteio`,
    description: raffle.description ?? undefined,
    openGraph: raffle.imageUrls[0] ? { images: [raffle.imageUrls[0]] } : undefined,
  };
}

export default async function RaffleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const raffle = await getPublicRaffleBySlug(slug);
  if (!raffle) notFound();

  const pct = raffle.totalNumbers > 0 ? Math.round((raffle.soldCount / raffle.totalNumbers) * 100) : 0;

  return (
    <main className="min-h-screen bg-background pt-24 pb-28 lg:pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          ← Voltar ao início
        </Link>

        <p className="text-primary text-xs font-semibold tracking-widest uppercase mb-1">Sorteio</p>
        <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl md:text-5xl text-foreground mb-6">{raffle.name}</h1>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Esquerda: galeria + descrição + prêmios */}
          <div className="flex flex-col gap-6">
            {raffle.imageUrls.length > 0 && (
              <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory rounded-xl" style={{ scrollbarWidth: "thin" }}>
                {raffle.imageUrls.map((url, i) => (
                  <div key={url + i} className="snap-center shrink-0 w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`${raffle.name} ${i + 1}`} className="w-full aspect-[4/3] object-cover rounded-xl border border-border" />
                  </div>
                ))}
              </div>
            )}

            {raffle.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{raffle.description}</p>
            )}

            {raffle.prizes.length > 0 && (
              <div>
                <h2 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground mb-3">Prêmios</h2>
                <ul className="flex flex-col gap-2">
                  {raffle.prizes.map((p, i) => (
                    <li key={p.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
                      <span className="shrink-0 w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">
                        {i + 1}º
                      </span>
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt={p.name} className="w-12 h-12 rounded object-cover border border-border shrink-0" />
                      ) : (
                        <span className="w-12 h-12 rounded bg-secondary flex items-center justify-center text-muted-foreground/40 shrink-0">
                          <Trophy size={18} />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                        {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Direita: compra + progresso */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-24 self-start">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-primary">{brl(raffle.numberPriceCents)}</span>
              <span className="text-sm text-muted-foreground">/ número</span>
            </div>

            {/* Progresso */}
            <div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">
                {raffle.soldCount.toLocaleString("pt-BR")} de {raffle.totalNumbers.toLocaleString("pt-BR")} vendidos ({pct}%)
              </p>
            </div>

            {raffle.salesEndsAt && raffle.status === "active" && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock size={13} /> Vendas até {new Date(raffle.salesEndsAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
              </p>
            )}

            <RaffleBuy
              raffleId={raffle.id}
              priceCents={raffle.numberPriceCents}
              availableCount={raffle.availableCount}
              maxPerCustomer={raffle.maxPerCustomer}
              status={raffle.status}
            />

            {raffle.status === "drawn" && (
              <Link
                href={`/rifa/${raffle.slug}/ganhadores`}
                className="inline-flex items-center justify-center gap-2 border border-border rounded-lg py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
              >
                Ver ganhadores <ArrowRight size={15} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
