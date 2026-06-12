import { getAdminTimelineEvents } from "@/app/actions/admin-institutional";
import { DraggableHistoriaTable } from "@/components/admin/DraggableHistoriaTable";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function HistoriaPage() {
  const events = await getAdminTimelineEvents();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground tracking-wide">HISTÓRIA</h2>
        <Link
          href="/admin/historia/novo"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Novo Evento
        </Link>
      </div>

      <DraggableHistoriaTable events={events} />
    </div>
  );
}
