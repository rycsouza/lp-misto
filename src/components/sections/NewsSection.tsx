import { getActiveNews } from "@/lib/db/queries";
import SectionWrapper from "@/components/ui/section-wrapper";
import { NewsTabs } from "./NewsTabs";

async function NewsSectionContent() {
  const allNews = await getActiveNews().catch(() => []);
  const featuredNews = allNews.find((n) => n.featured) ?? allNews[0] ?? null;
  const remaining = allNews.filter((n) => n !== featuredNews);

  return (
    <section id="noticias" className="py-16 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-primary text-sm font-semibold tracking-widest uppercase text-center mb-2">
          Últimas Notícias
        </p>
        <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-center text-foreground mb-10">
          Fique por Dentro
        </h2>
        <NewsTabs
          featuredNews={
            featuredNews
              ? {
                  ...featuredNews,
                  publishedAt: featuredNews.publishedAt ?? null,
                }
              : null
          }
          remainingNews={remaining.map((n) => ({
            ...n,
            publishedAt: n.publishedAt ?? null,
          }))}
        />
      </div>
    </section>
  );
}

export default async function NewsSection() {
  return (
    <SectionWrapper sectionKey="news">
      <NewsSectionContent />
    </SectionWrapper>
  );
}
