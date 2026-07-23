import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listPublicRaffles } from "@/lib/raffle/queries";
import { getSectionEnabled } from "@/lib/config";
import { formatSoldPct } from "@/lib/utils";

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/**
 * Banner de sorteios ATIVOS na home. Some se a seção "raffle" estiver desligada
 * em Configurações → Seções, ou se não houver sorteio à venda. O kill-switch de
 * plataforma é tratado no filtro da home (feature "rifas" → seção "raffle").
 */
export default async function RaffleSection() {
  if (!(await getSectionEnabled("raffle"))) return null;

  const raffles = (await listPublicRaffles().catch(() => [])).filter((r) => r.status === "active");
  if (raffles.length === 0) return null;

  return (
    <section id="rifa" className="py-16 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-primary text-sm font-semibold tracking-widest uppercase mb-1">Sorteio</p>
        <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-foreground mb-6">
          {raffles.length === 1 ? "Participe do sorteio" : "Sorteios abertos"}
        </h2>

        <div className={raffles.length === 1 ? "" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
          {raffles.map((r) => {
            const pct = r.totalNumbers > 0 ? (r.soldCount / r.totalNumbers) * 100 : 0;
            const pctLabel = formatSoldPct(r.soldCount, r.totalNumbers);
            return (
              <Link
                key={r.id}
                href={`/rifa/${r.slug}`}
                className="group block bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/50 transition-colors"
              >
                <div className={raffles.length === 1 ? "sm:flex" : ""}>
                  {r.imageUrls[0] && (
                    <div className={raffles.length === 1 ? "sm:w-1/2" : ""}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.imageUrls[0]}
                        alt={r.name}
                        className={`w-full object-cover ${raffles.length === 1 ? "h-56 sm:h-full" : "h-44"}`}
                      />
                    </div>
                  )}
                  <div className={`p-5 flex flex-col gap-3 ${raffles.length === 1 ? "sm:w-1/2 sm:justify-center" : ""}`}>
                    <h3 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground leading-tight">{r.name}</h3>
                    {r.description && raffles.length === 1 && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
                    )}
                    <div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 tabular-nums">{pctLabel}% vendido</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        <span className="text-muted-foreground">a partir de </span>
                        <span className="font-bold text-primary">{brl(r.numberPriceCents)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-2.5 transition-all">
                        Participar <ArrowRight size={15} />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
