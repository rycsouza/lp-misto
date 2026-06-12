import { BoardMemberForm } from "@/components/admin/BoardMemberForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function NovoMembroPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link
        href="/admin/diretoria"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft size={16} />
        Voltar para diretoria
      </Link>

      <h2 className="font-display text-xl text-foreground tracking-wide">
        NOVO MEMBRO
      </h2>

      <div className="bg-card border border-border rounded-xl p-6">
        <BoardMemberForm />
      </div>
    </div>
  );
}
