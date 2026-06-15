import { verifyAffiliateToken } from "@/app/actions/affiliate-auth";
import { XCircle } from "lucide-react";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function AffiliateAuthPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return <ErrorView message="Link inválido." />;
  }

  const result = await verifyAffiliateToken(token);

  // verifyAffiliateToken redirects on success — if we reach here, it failed
  return <ErrorView message={result.error ?? "Erro ao validar link."} />;
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-destructive/10 mb-4">
          <XCircle size={24} className="text-destructive" />
        </div>
        <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-2">
          Link inválido
        </h1>
        <p className="text-muted-foreground text-sm mb-6">{message}</p>
        <Link
          href="/afiliados/login"
          className="inline-block bg-primary text-primary-foreground px-6 py-2.5 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Solicitar novo link
        </Link>
      </div>
    </div>
  );
}
