"use client";

import { useState } from "react";
import Image from "next/image";

type NewsCategory =
  | "futebol_profissional"
  | "base"
  | "institucional"
  | "socio_torcedor"
  | "patrocinadores";

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  category: NewsCategory;
  imageUrl?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  featured: boolean;
  publishedAt?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  futebol_profissional: "Futebol",
  base: "Base",
  institucional: "Institucional",
  socio_torcedor: "Sócio-Torcedor",
  patrocinadores: "Patrocinadores",
};

const PAGE_SIZE = 3;

interface NewsTabsProps {
  featuredNews: NewsItem | null;
  remainingNews: NewsItem[];
}

export function NewsTabs({ featuredNews, remainingNews }: NewsTabsProps) {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const categories = Array.from(new Set(remainingNews.map((n) => n.category)));
  const filtered =
    activeTab === "all" ? remainingNews : remainingNews.filter((n) => n.category === activeTab);
  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  function selectTab(tab: string) {
    setActiveTab(tab);
    setVisible(PAGE_SIZE);
  }

  return (
    <div>
      {/* featured */}
      {featuredNews && (
        <div className="mb-10">
          {(() => {
            const year = featuredNews.publishedAt
              ? new Date(featuredNews.publishedAt).getFullYear()
              : null;

            const inner = (
              <>
                {featuredNews.imageUrl && (
                  <div className="relative w-full md:w-[40%] aspect-[16/9] md:aspect-auto md:min-h-[260px] shrink-0 overflow-hidden">
                    <Image
                      src={featuredNews.imageUrl}
                      alt={featuredNews.title}
                      fill
                      priority
                      sizes="(max-width: 768px) 100vw, 40vw"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 p-8 flex flex-col justify-center gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest">
                        Destaque
                      </span>
                      <span className="text-xs text-primary uppercase tracking-widest font-semibold">
                        {CATEGORY_LABELS[featuredNews.category] ?? featuredNews.category}
                      </span>
                    </div>
                    {year && (
                      <span className="text-xs text-muted-foreground">{year}</span>
                    )}
                  </div>
                  <h3 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground leading-tight">
                    {featuredNews.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed line-clamp-4">{featuredNews.summary}</p>
                  {featuredNews.source && (
                    <p className="text-xs text-muted-foreground/60">Fonte: {featuredNews.source}</p>
                  )}
                  {featuredNews.sourceUrl && (
                    <span className="text-sm text-primary font-semibold self-start">Leia Mais →</span>
                  )}
                </div>
              </>
            );

            const cls =
              "relative bg-card border border-border rounded-xl overflow-hidden flex flex-col md:flex-row hover:shadow-[0_0_15px_rgba(193,154,90,0.4)] transition-all";

            return featuredNews.sourceUrl ? (
              <a href={featuredNews.sourceUrl} target="_blank" rel="noopener noreferrer" className={cls}>
                {inner}
              </a>
            ) : (
              <div className={cls}>{inner}</div>
            );
          })()}
        </div>
      )}

      {/* filter tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => selectTab("all")}
          className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
            activeTab === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          Todos
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => selectTab(cat)}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
              activeTab === cat
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* grid */}
      {shown.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Nenhuma notícia nesta categoria.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {shown.map((item) => {
            const CardWrapper = item.sourceUrl
              ? ({ children }: { children: React.ReactNode }) => (
                  <a
                    href={item.sourceUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-card border border-border rounded-xl overflow-hidden flex flex-col hover:shadow-[0_0_15px_rgba(193,154,90,0.4)] transition-all cursor-pointer"
                  >
                    {children}
                  </a>
                )
              : ({ children }: { children: React.ReactNode }) => (
                  <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
                    {children}
                  </div>
                );

            return (
              <article key={item.id}>
                <CardWrapper>
                  {item.imageUrl && (
                    <div className="relative h-44 shrink-0">
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4 flex flex-col flex-1">
                    <span className="text-xs text-primary uppercase tracking-widest">
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </span>
                    <h3 className="font-[family-name:var(--font-bebas-neue)] text-xl text-foreground mt-1 mb-2 leading-tight">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground text-sm line-clamp-2 flex-1">{item.summary}</p>
                    {item.sourceUrl && (
                      <span className="mt-3 text-xs text-primary self-start">Leia mais →</span>
                    )}
                  </div>
                </CardWrapper>
              </article>
            );
          })}
        </div>
      )}

      {/* ver mais */}
      {hasMore && (
        <div className="flex justify-center mt-8">
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="px-8 py-3 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-all"
          >
            Ver mais ({filtered.length - visible} restantes)
          </button>
        </div>
      )}
    </div>
  );
}
