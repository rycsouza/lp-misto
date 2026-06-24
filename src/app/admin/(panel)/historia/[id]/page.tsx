export const dynamic = "force-dynamic";

import { getAdminTimelineEventById } from "@/app/actions/admin-institutional";
import { TimelineEventForm } from "@/components/admin/TimelineEventForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarEventoPage({ params }: PageProps) {
  const { id } = await params;
  const event = await getAdminTimelineEventById(id);

  if (!event) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link
        href="/admin/historia"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft size={16} />
        Voltar para história
      </Link>

      <h2 className="font-display text-xl text-foreground tracking-wide">
        EDITAR EVENTO
      </h2>

      <div className="bg-card border border-border rounded-xl p-6">
        <TimelineEventForm
          event={{
            id: event.id,
            year: event.year,
            title: event.title,
            description: event.description,
            order: event.order,
          }}
        />
      </div>
    </div>
  );
}
