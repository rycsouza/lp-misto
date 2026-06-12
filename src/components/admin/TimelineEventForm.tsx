"use client";

import { useActionState } from "react";
import {
  createTimelineEvent,
  updateTimelineEvent,
} from "@/app/actions/admin-institutional";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type TimelineEventFormState =
  | { success: boolean; error?: string }
  | undefined;

interface EventData {
  id?: string;
  year?: string;
  title?: string;
  description?: string;
  order?: number;
}

interface TimelineEventFormProps {
  event?: EventData;
}

export function TimelineEventForm({ event }: TimelineEventFormProps) {
  const router = useRouter();
  const isEditing = !!event?.id;

  async function handleCreate(
    _prev: TimelineEventFormState,
    formData: FormData
  ): Promise<TimelineEventFormState> {
    const orderStr = formData.get("order") as string;
    const data = {
      year: formData.get("year") as string,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      order: orderStr ? parseInt(orderStr, 10) : 0,
    };
    return createTimelineEvent(data);
  }

  async function handleUpdate(
    _prev: TimelineEventFormState,
    formData: FormData
  ): Promise<TimelineEventFormState> {
    const orderStr = formData.get("order") as string;
    const data = {
      year: formData.get("year") as string,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      order: orderStr ? parseInt(orderStr, 10) : 0,
    };
    return updateTimelineEvent(event!.id!, data);
  }

  const [state, action, pending] = useActionState<
    TimelineEventFormState,
    FormData
  >(isEditing ? handleUpdate : handleCreate, undefined);

  useEffect(() => {
    if (state?.success) {
      router.push("/admin/historia");
    }
  }, [state, router]);

  const inputClass =
    "w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";
  const labelClass = "text-sm text-muted-foreground mb-1 block";

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="year" className={labelClass}>
            Ano *
          </label>
          <input
            id="year"
            name="year"
            type="number"
            required
            min={1900}
            max={2100}
            defaultValue={event?.year ?? ""}
            className={inputClass}
            placeholder="Ex: 1914"
          />
        </div>

        <div>
          <label htmlFor="order" className={labelClass}>
            Ordem
          </label>
          <input
            id="order"
            name="order"
            type="number"
            min={0}
            defaultValue={event?.order ?? 0}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="title" className={labelClass}>
            Título *
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={event?.title ?? ""}
            className={inputClass}
            placeholder="Título do evento histórico"
            maxLength={200}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="description" className={labelClass}>
            Descrição *
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={5}
            defaultValue={event?.description ?? ""}
            className={inputClass}
            placeholder="Descrição detalhada do evento"
          />
        </div>
      </div>

      {state && !state.success && state.error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {pending ? "Salvando..." : "Salvar Evento"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/historia")}
          className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
