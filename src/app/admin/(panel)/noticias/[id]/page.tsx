export const dynamic = "force-dynamic";

import { getAdminNewsById } from "@/app/actions/admin-content";
import { NewsForm } from "@/components/admin/NewsForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarNoticiaPage({ params }: PageProps) {
  const { id } = await params;
  const news = await getAdminNewsById(id);

  if (!news) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link
        href="/admin/noticias"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft size={16} />
        Voltar para notícias
      </Link>

      <h2 className="font-display text-xl text-foreground tracking-wide">
        EDITAR NOTÍCIA
      </h2>

      <div className="bg-card border border-border rounded-xl p-6">
        <NewsForm
          news={{
            id: news.id,
            title: news.title,
            summary: news.summary,
            category: news.category,
            imageUrl: news.imageUrl,
            source: news.source,
            sourceUrl: news.sourceUrl,
            featured: news.featured,
            publishedAt: news.publishedAt,
            active: news.active,
          }}
        />
      </div>
    </div>
  );
}
