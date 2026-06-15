import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AffiliateForm } from "@/components/admin/AffiliateForm";

export default function NovoAfiliadoPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/afiliados"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground">
          Novo Afiliado
        </h1>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <AffiliateForm />
      </div>
    </div>
  );
}
