export const dynamic = "force-dynamic";

import { getAdminPersonalityById } from "@/app/actions/admin-institutional";
import { PersonalityForm } from "@/components/admin/PersonalityForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarPersonalidadePage({ params }: PageProps) {
  const { id } = await params;
  const personality = await getAdminPersonalityById(id);

  if (!personality) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link
        href="/admin/personalidades"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft size={16} />
        Voltar para personalidades
      </Link>

      <h2 className="font-display text-xl text-foreground tracking-wide">
        EDITAR PERSONALIDADE
      </h2>

      <div className="bg-card border border-border rounded-xl p-6">
        <PersonalityForm
          personality={{
            id: personality.id,
            name: personality.name,
            photoUrl: personality.photoUrl,
            role: personality.role,
            category: personality.category,
            active: personality.active,
            order: personality.order,
          }}
        />
      </div>
    </div>
  );
}
