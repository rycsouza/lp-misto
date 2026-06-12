"use client";

import { useActionState } from "react";
import {
  createBoardMember,
  updateBoardMember,
} from "@/app/actions/admin-institutional";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type BoardMemberFormState =
  | { success: boolean; id?: string; error?: string }
  | undefined;

interface MemberData {
  id?: string;
  name?: string;
  role?: string;
  profession?: string | null;
  photoUrl?: string | null;
  group?: string;
  fiscalType?: string | null;
  order?: number;
  active?: boolean;
}

interface BoardMemberFormProps {
  member?: MemberData;
}

export function BoardMemberForm({ member }: BoardMemberFormProps) {
  const router = useRouter();
  const isEditing = !!member?.id;
  const [selectedGroup, setSelectedGroup] = useState(
    member?.group ?? "executive"
  );

  async function handleCreate(
    _prev: BoardMemberFormState,
    formData: FormData
  ): Promise<BoardMemberFormState> {
    const groupVal = formData.get("group") as string;
    const orderStr = formData.get("order") as string;
    const data = {
      name: formData.get("name") as string,
      role: formData.get("role") as string,
      profession: (formData.get("profession") as string) || null,
      photoUrl: (formData.get("photoUrl") as string) || null,
      group: groupVal,
      fiscalType:
        groupVal === "fiscal"
          ? ((formData.get("fiscalType") as string) || null)
          : null,
      order: orderStr ? parseInt(orderStr, 10) : 0,
      active: formData.get("active") === "on",
    };
    return createBoardMember(data);
  }

  async function handleUpdate(
    _prev: BoardMemberFormState,
    formData: FormData
  ): Promise<BoardMemberFormState> {
    const groupVal = formData.get("group") as string;
    const orderStr = formData.get("order") as string;
    const data = {
      name: formData.get("name") as string,
      role: formData.get("role") as string,
      profession: (formData.get("profession") as string) || null,
      photoUrl: (formData.get("photoUrl") as string) || null,
      group: groupVal,
      fiscalType:
        groupVal === "fiscal"
          ? ((formData.get("fiscalType") as string) || null)
          : null,
      order: orderStr ? parseInt(orderStr, 10) : 0,
      active: formData.get("active") === "on",
    };
    return updateBoardMember(member!.id!, data);
  }

  const [state, action, pending] = useActionState<
    BoardMemberFormState,
    FormData
  >(isEditing ? handleUpdate : handleCreate, undefined);

  useEffect(() => {
    if (state?.success) {
      router.push("/admin/diretoria");
    }
  }, [state, router]);

  const inputClass =
    "w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";
  const labelClass = "text-sm text-muted-foreground mb-1 block";

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="sm:col-span-2">
          <label htmlFor="name" className={labelClass}>
            Nome *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={member?.name ?? ""}
            className={inputClass}
            placeholder="Nome completo"
          />
        </div>

        <div>
          <label htmlFor="role" className={labelClass}>
            Cargo *
          </label>
          <input
            id="role"
            name="role"
            type="text"
            required
            defaultValue={member?.role ?? ""}
            className={inputClass}
            placeholder="Ex: Presidente"
          />
        </div>

        <div>
          <label htmlFor="profession" className={labelClass}>
            Profissão
          </label>
          <input
            id="profession"
            name="profession"
            type="text"
            defaultValue={member?.profession ?? ""}
            className={inputClass}
            placeholder="Ex: Advogado"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="photoUrl" className={labelClass}>
            URL da Foto
          </label>
          <input
            id="photoUrl"
            name="photoUrl"
            type="text"
            defaultValue={member?.photoUrl ?? ""}
            className={inputClass}
            placeholder="https://..."
          />
        </div>

        <div>
          <label htmlFor="group" className={labelClass}>
            Grupo *
          </label>
          <select
            id="group"
            name="group"
            required
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className={inputClass}
          >
            <option value="executive">Executiva</option>
            <option value="fiscal">Conselho Fiscal</option>
          </select>
        </div>

        {selectedGroup === "fiscal" && (
          <div>
            <label htmlFor="fiscalType" className={labelClass}>
              Tipo Fiscal
            </label>
            <select
              id="fiscalType"
              name="fiscalType"
              defaultValue={member?.fiscalType ?? "titular"}
              className={inputClass}
            >
              <option value="titular">Titular</option>
              <option value="suplente">Suplente</option>
            </select>
          </div>
        )}

        <div>
          <label htmlFor="order" className={labelClass}>
            Ordem
          </label>
          <input
            id="order"
            name="order"
            type="number"
            min={0}
            defaultValue={member?.order ?? 0}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
          <input
            type="checkbox"
            name="active"
            defaultChecked={member?.active ?? true}
            className="w-4 h-4 rounded border-border bg-input"
          />
          Ativo (exibir na plataforma)
        </label>
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
          {pending ? "Salvando..." : "Salvar Membro"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/diretoria")}
          className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
