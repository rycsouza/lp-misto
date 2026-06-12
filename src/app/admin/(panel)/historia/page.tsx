import { getAdminTimelineEvents } from "@/app/actions/admin-institutional";
import { TimelineEventActions } from "@/components/admin/TimelineEventActions";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function HistoriaPage() {
  const events = await getAdminTimelineEvents();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground tracking-wide">
          HISTÓRIA
        </h2>
        <Link
          href="/admin/historia/novo"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Novo Evento
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Ano
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Título
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Descrição
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Ordem
                </th>
                <th className="text-right text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center text-muted-foreground py-10"
                  >
                    Nenhum evento cadastrado
                  </td>
                </tr>
              )}
              {events.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-4 py-3 text-foreground font-semibold">
                    {event.year}
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium max-w-xs">
                    <span className="block truncate" title={event.title}>
                      {event.title}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-sm">
                    <span
                      className="block truncate"
                      title={event.description}
                    >
                      {event.description}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {event.order}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <TimelineEventActions eventId={event.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
