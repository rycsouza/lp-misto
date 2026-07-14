"use client";

import { useActionState } from "react";
import { createNews, updateNews } from "@/app/actions/admin-content";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ImageUpload } from "./ImageUpload";
import { MarkdownEditor } from "./MarkdownEditor";

type NewsFormState =
  | { success: boolean; id?: string; error?: string }
  | undefined;

interface NewsData {
  id?: string;
  title?: string;
  summary?: string;
  category?: string;
  imageUrl?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  featured?: boolean;
  publishedAt?: string | null;
  active?: boolean;
}

interface NewsFormProps {
  news?: NewsData;
}

export function NewsForm({ news }: NewsFormProps) {
  const router = useRouter();
  const isEditing = !!news?.id;

  async function handleCreate(
    _prev: NewsFormState,
    formData: FormData
  ): Promise<NewsFormState> {
    const data = {
      title: formData.get("title") as string,
      summary: formData.get("summary") as string,
      category: formData.get("category") as string,
      imageUrl: (formData.get("imageUrl") as string) || null,
      source: (formData.get("source") as string) || null,
      sourceUrl: (formData.get("sourceUrl") as string) || null,
      featured: formData.get("featured") === "on",
      publishedAt: (formData.get("publishedAt") as string) || null,
      active: formData.get("active") === "on",
    };
    return createNews(data);
  }

  async function handleUpdate(
    _prev: NewsFormState,
    formData: FormData
  ): Promise<NewsFormState> {
    const data = {
      title: formData.get("title") as string,
      summary: formData.get("summary") as string,
      category: formData.get("category") as string,
      imageUrl: (formData.get("imageUrl") as string) || null,
      source: (formData.get("source") as string) || null,
      sourceUrl: (formData.get("sourceUrl") as string) || null,
      featured: formData.get("featured") === "on",
      publishedAt: (formData.get("publishedAt") as string) || null,
      active: formData.get("active") === "on",
    };
    return updateNews(news!.id!, data);
  }

  const [state, action, pending] = useActionState<NewsFormState, FormData>(
    isEditing ? handleUpdate : handleCreate,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      router.push("/admin/noticias");
    }
  }, [state, router]);

  const inputClass =
    "w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";
  const selectClass =
    "form-select w-full bg-input border border-border rounded-md pl-3 pr-9 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";
  const labelClass = "text-sm text-muted-foreground mb-1 block";

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="sm:col-span-2">
          <label htmlFor="title" className={labelClass}>
            Título *
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={news?.title ?? ""}
            className={inputClass}
            placeholder="Título da notícia"
            maxLength={200}
          />
        </div>

        <div className="sm:col-span-2">
          <MarkdownEditor
            name="summary"
            defaultValue={news?.summary ?? ""}
            label="Conteúdo"
            required
          />
        </div>

        <div>
          <label htmlFor="category" className={labelClass}>
            Categoria *
          </label>
          <select
            id="category"
            name="category"
            required
            defaultValue={news?.category ?? ""}
            className={selectClass}
          >
            <option value="">Selecione...</option>
            <option value="futebol_profissional">Futebol Profissional</option>
            <option value="base">Base</option>
            <option value="institucional">Institucional</option>
            <option value="socio_torcedor">Sócio-Torcedor</option>
            <option value="patrocinadores">Patrocinadores</option>
          </select>
        </div>

        <div>
          <label htmlFor="publishedAt" className={labelClass}>
            Data de Publicação
          </label>
          <input
            id="publishedAt"
            name="publishedAt"
            type="date"
            defaultValue={news?.publishedAt ?? ""}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <ImageUpload
            name="imageUrl"
            defaultValue={news?.imageUrl}
            label="Imagem de Capa"
            folder="misto/noticias"
          />
        </div>

        <div>
          <label htmlFor="source" className={labelClass}>
            Fonte
          </label>
          <input
            id="source"
            name="source"
            type="text"
            defaultValue={news?.source ?? ""}
            className={inputClass}
            placeholder="Nome da fonte"
          />
        </div>

        <div>
          <label htmlFor="sourceUrl" className={labelClass}>
            URL da Fonte
          </label>
          <input
            id="sourceUrl"
            name="sourceUrl"
            type="url"
            defaultValue={news?.sourceUrl ?? ""}
            className={inputClass}
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={news?.featured ?? false}
            className="w-4 h-4 rounded border-border bg-input"
          />
          Destaque (desativa destaque em outras)
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
          <input
            type="checkbox"
            name="active"
            defaultChecked={news?.active ?? true}
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
          {pending ? "Salvando..." : "Salvar Notícia"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/noticias")}
          className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
