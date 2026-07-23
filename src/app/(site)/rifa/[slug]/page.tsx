export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Trophy, Clock, ArrowRight, ArrowLeft, Ticket, QrCode, ShieldCheck, Flame, Medal } from "lucide-react";
import { getPublicRaffleBySlug } from "@/lib/raffle/queries";
import { formatSoldPct } from "@/lib/utils";
import { RaffleBuy } from "@/components/raffle/RaffleBuy";
import { RaffleGallery } from "@/components/raffle/RaffleGallery";

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function num(n: number) {
  return n.toLocaleString("pt-BR");
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

// Medalha por posição (1º ouro, 2º prata, 3º bronze, demais dourado suave).
const MEDAL = [
  "bg-gradient-to-br from-yellow-300 to-amber-500 text-black",
  "bg-gradient-to-br from-slate-200 to-slate-400 text-black",
  "bg-gradient-to-br from-amber-600 to-amber-800 text-white",
];

const STEPS = [
  { icon: Ticket, title: "Escolha os números", desc: "Você define quantos números quer comprar." },
  { icon: QrCode, title: "Pague com PIX", desc: "Pagamento na hora. Os números são sorteados e revelados após a confirmação." },
  { icon: Trophy, title: "Concorra ao prêmio", desc: "Acompanhe o resultado em “Meus Pedidos” e na página de ganhadores." },
];

export default async function RaffleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const raffle = await getPublicRaffleBySlug(slug);
  if (!raffle) notFound();

  const pctValue = raffle.totalNumbers > 0 ? (raffle.soldCount / raffle.totalNumbers) * 100 : 0;
  const pctLabel = formatSoldPct(raffle.soldCount, raffle.totalNumbers);
  const remaining = raffle.availableCount;
  const lowStock = raffle.status === "active" && remaining > 0 && remaining <= Math.max(20, Math.ceil(raffle.totalNumbers * 0.1));

  const statusBadge =
    raffle.status === "active"
      ? { label: "À venda", cls: "bg-green-500/15 text-green-400 border-green-500/30" }
      : raffle.status === "drawn"
        ? { label: "Sorteio realizado", cls: "bg-primary/15 text-primary border-primary/30" }
        : { label: "Vendas encerradas", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" };

  return (
    <main className="min-h-screen bg-background pt-24 pb-28 lg:pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft size={15} /> Voltar ao início
        </Link>

        {/* Cabeçalho */}
        <div className="flex flex-col gap-3 mb-8">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-primary text-xs font-semibold tracking-widest uppercase">Sorteio</p>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl md:text-6xl leading-[0.95] text-foreground">{raffle.name}</h1>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
          {/* Galeria (topo em ambos) */}
          {raffle.imageUrls.length > 0 && (
            <div className="order-1 lg:order-none lg:col-start-1 lg:row-start-1">
              <RaffleGallery images={raffle.imageUrls} alt={raffle.name} />
            </div>
          )}

          {/* Descrição + prêmios (no mobile, abaixo do card) */}
          <div className="order-3 lg:order-none flex flex-col gap-8 min-w-0 lg:col-start-1 lg:row-start-2">
            {raffle.description && (
              <p className="text-sm md:text-[15px] text-muted-foreground whitespace-pre-line leading-relaxed">{raffle.description}</p>
            )}

            {/* Prêmios */}
            {raffle.prizes.length > 0 && (
              <div>
                <h2 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground mb-4 flex items-center gap-2">
                  <Trophy size={20} className="text-primary" /> {raffle.prizes.length > 1 ? "Prêmios" : "Prêmio"}
                </h2>
                <ul className="grid sm:grid-cols-2 gap-3">
                  {raffle.prizes.map((p, i) => (
                    <li key={p.id} className="group flex items-center gap-3 bg-card border border-border rounded-2xl p-3 hover:border-primary/40 transition-colors">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt={p.name} className="w-16 h-16 rounded-xl object-cover border border-border shrink-0" />
                      ) : (
                        <span className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground/40 shrink-0">
                          <Trophy size={22} />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${MEDAL[i] ?? "bg-primary/15 text-primary"}`}>
                          <Medal size={10} /> {i + 1}º prêmio
                        </span>
                        <p className="text-sm font-semibold text-foreground truncate mt-1">{p.name}</p>
                        {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Card de compra — antes dos prêmios no mobile, coluna direita sticky no desktop */}
          <div className="order-2 lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-24">
            <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-lg shadow-black/20">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-primary">{brl(raffle.numberPriceCents)}</span>
                <span className="text-sm text-muted-foreground">/ número</span>
              </div>

              {/* Progresso */}
              <div>
                <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all" style={{ width: `${Math.max(pctValue, 2)}%` }} />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-xs text-muted-foreground tabular-nums">{num(raffle.soldCount)} de {num(raffle.totalNumbers)} vendidos</p>
                  <p className="text-xs font-semibold text-foreground tabular-nums">{pctLabel}%</p>
                </div>
              </div>

              {/* Escassez / disponibilidade */}
              {raffle.status === "active" && (
                lowStock ? (
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
                    <Flame size={14} /> Últimos {num(remaining)} números!
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground tabular-nums">{num(remaining)} números disponíveis</p>
                )
              )}

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
                  className="inline-flex items-center justify-center gap-2 bg-primary/10 border border-primary/30 text-primary rounded-lg py-2.5 text-sm font-semibold hover:bg-primary/20 transition-colors"
                >
                  <Trophy size={15} /> Ver ganhadores <ArrowRight size={15} />
                </Link>
              )}

              {/* Confiança */}
              <ul className="flex flex-col gap-2 border-t border-border/60 pt-3 mt-1">
                <li className="flex items-center gap-2 text-xs text-muted-foreground"><QrCode size={14} className="text-primary/70 shrink-0" /> Pagamento instantâneo via PIX</li>
                <li className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={14} className="text-primary/70 shrink-0" /> Números sorteados de forma aleatória</li>
                <li className="flex items-center gap-2 text-xs text-muted-foreground"><Trophy size={14} className="text-primary/70 shrink-0" /> Resultado público e transparente</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Como funciona */}
        <section className="mt-14">
          <h2 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground mb-5 text-center">Como funciona</h2>
          <ol className="grid sm:grid-cols-3 gap-4">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={s.title} className="relative bg-card border border-border rounded-2xl p-5 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <Icon size={18} />
                    </span>
                    <span className="font-[family-name:var(--font-bebas-neue)] text-2xl text-primary/40 tabular-nums">{i + 1}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{s.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </main>
  );
}
