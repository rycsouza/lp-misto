import { TimelineEventForm } from "@/components/admin/TimelineEventForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function NovoEventoPage() {
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
        NOVO EVENTO
      </h2>

      <div className="bg-card border border-border rounded-xl p-6">
        <TimelineEventForm />
      </div>
    </div>
  );
}
